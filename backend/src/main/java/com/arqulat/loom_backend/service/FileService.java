package com.arqulat.loom_backend.service;

import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.arqulat.loom_backend.dto.FileRequests.CreateFileRequest;
import com.arqulat.loom_backend.dto.FileRequests.UpdateFileRequest;
import com.arqulat.loom_backend.dto.Responses.FileDetailDTO;
import com.arqulat.loom_backend.dto.Responses.FileSummaryDTO;
import com.arqulat.loom_backend.dto.Responses.FileVersionDTO;
import com.arqulat.loom_backend.model.DiagramFile;
import com.arqulat.loom_backend.model.DiagramFileVersion;
import com.arqulat.loom_backend.model.Project;
import com.arqulat.loom_backend.repository.DiagramFileRepository;
import com.arqulat.loom_backend.repository.DiagramFileVersionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class FileService {

    @Autowired
    private DiagramFileRepository fileRepository;

    @Autowired
    private DiagramFileVersionRepository versionRepository;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<FileSummaryDTO> getProjectFiles(UUID projectId, UUID userId) {
        projectService.getProjectIfOwned(projectId, userId); // Ensure ownership
        List<DiagramFile> files = fileRepository.findByProjectIdOrderByUpdatedAtDesc(projectId);
        return files.stream().map(this::mapToSummary).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public FileDetailDTO getFileDetail(UUID fileId, UUID userId) {
        DiagramFile file = getFileIfOwned(fileId, userId);
        return mapToDetail(file);
    }

    @Transactional
    public FileSummaryDTO createFile(UUID projectId, UUID userId, CreateFileRequest request) {
        Project project = projectService.getProjectIfOwned(projectId, userId);
        
        if (fileRepository.existsByProjectIdAndName(projectId, request.getName())) {
            throw new com.arqulat.loom_backend.exception.DuplicateResourceException("A file with this name already exists in the project");
        }
        
        JsonNode emptyNodes = objectMapper.createArrayNode();
        DiagramFile file = DiagramFile.builder()
                .name(request.getName())
                .canvasBgColor(request.getBackgroundColor() != null ? request.getBackgroundColor() : "#0f0f0f")
                .project(project)
                .nodes(emptyNodes)
                .build();
        
        DiagramFile saved = fileRepository.save(file);

        // Snapshot initial version
        DiagramFileVersion version = DiagramFileVersion.builder()
                .diagramFile(saved)
                .nodes(emptyNodes)
                .build();
        versionRepository.save(version);

        return mapToSummary(saved);
    }

    @Transactional
    public FileDetailDTO updateFile(UUID fileId, UUID userId, UpdateFileRequest request) {
        DiagramFile file = getFileIfOwned(fileId, userId);
        if (request.getName() != null && !request.getName().equals(file.getName())) {
            if (fileRepository.existsByProjectIdAndName(file.getProject().getId(), request.getName())) {
                throw new com.arqulat.loom_backend.exception.DuplicateResourceException("A file with this name already exists in the project");
            }
            file.setName(request.getName());
        }
        if (request.getCanvasBgColor() != null) {
            file.setCanvasBgColor(request.getCanvasBgColor());
        }
        if (request.getNodes() != null) {
            JsonNode nodesJson = objectMapper.valueToTree(request.getNodes());
            if (nodesJson.toString().length() > 5_000_000) {
                throw new com.arqulat.loom_backend.exception.PayloadTooLargeException("Diagram payload exceeds the maximum allowed size of 5MB");
            }
            file.setNodes(nodesJson);

            // Snapshot updated version
            DiagramFileVersion version = DiagramFileVersion.builder()
                    .diagramFile(file)
                    .nodes(nodesJson)
                    .build();
            versionRepository.save(version);
        }
        DiagramFile updated = fileRepository.save(file);
        return mapToDetail(updated);
    }

    @Transactional(readOnly = true)
    public List<FileVersionDTO> getFileVersions(UUID fileId, UUID userId) {
        getFileIfOwned(fileId, userId); // Verify ownership
        List<DiagramFileVersion> versions = versionRepository.findByDiagramFileIdOrderByCreatedAtDesc(fileId);
        return versions.stream().map(this::mapToVersionDTO).collect(Collectors.toList());
    }

    @Transactional
    public FileDetailDTO restoreFileVersion(UUID fileId, UUID versionId, UUID userId) {
        DiagramFile file = getFileIfOwned(fileId, userId);
        DiagramFileVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new com.arqulat.loom_backend.exception.ResourceNotFoundException("Version not found"));
        
        if (!version.getDiagramFile().getId().equals(fileId)) {
            throw new IllegalArgumentException("Version does not belong to the requested file");
        }

        // Restore file nodes
        file.setNodes(version.getNodes());
        DiagramFile updated = fileRepository.save(file);

        // Optional: Save a new version representing the restoration action itself
        DiagramFileVersion restoredVersionSnapshot = DiagramFileVersion.builder()
                .diagramFile(file)
                .nodes(version.getNodes())
                .build();
        versionRepository.save(restoredVersionSnapshot);

        return mapToDetail(updated);
    }

    @Transactional
    public void deleteFile(UUID fileId, UUID userId) {
        DiagramFile file = getFileIfOwned(fileId, userId);
        Project project = file.getProject();
        if (project.getFiles().size() <= 1) {
            throw new IllegalArgumentException("Cannot delete the last file in a project.");
        }
        project.getFiles().remove(file);
        fileRepository.delete(file);
    }

    private DiagramFile getFileIfOwned(UUID fileId, UUID userId) {
        DiagramFile file = fileRepository.findById(fileId)
                .orElseThrow(() -> new com.arqulat.loom_backend.exception.ResourceNotFoundException("File not found"));
        if (!file.getProject().getUserId().equals(userId)) {
            throw new com.arqulat.loom_backend.exception.UnauthorizedAccessException("Unauthorized to access this file");
        }
        return file;
    }

    private FileSummaryDTO mapToSummary(DiagramFile file) {
        int nodeCount = 0;
        if (file.getNodes() != null && file.getNodes().isArray()) {
            nodeCount = file.getNodes().size();
        }
        return FileSummaryDTO.builder()
                .id(file.getId())
                .name(file.getName())
                .canvasBgColor(file.getCanvasBgColor())
                .nodeCount(nodeCount)
                .updatedAt(file.getUpdatedAt() != null ? file.getUpdatedAt().toInstant(ZoneOffset.UTC).toEpochMilli() : System.currentTimeMillis())
                .build();
    }

    private FileDetailDTO mapToDetail(DiagramFile file) {
        return FileDetailDTO.builder()
                .id(file.getId())
                .name(file.getName())
                .canvasBgColor(file.getCanvasBgColor())
                .nodes(file.getNodes())
                .updatedAt(file.getUpdatedAt() != null ? file.getUpdatedAt().toInstant(ZoneOffset.UTC).toEpochMilli() : System.currentTimeMillis())
                .build();
    }

    private FileVersionDTO mapToVersionDTO(DiagramFileVersion version) {
        return FileVersionDTO.builder()
                .id(version.getId())
                .createdAt(version.getCreatedAt() != null ? version.getCreatedAt().toInstant(ZoneOffset.UTC).toEpochMilli() : System.currentTimeMillis())
                .build();
    }
}
