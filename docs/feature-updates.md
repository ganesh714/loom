# Feature Update Log — Arqulat Arc (v0.2 — refactor1)

> **Branch:** `refactor1`  
> **Date:** July 7, 2026  
> **Status:** In Development / Pull Request Pending

---

## Overview

This document describes all the new features and interface improvements introduced in the current `refactor1` development cycle. The changes span across the canvas interaction layer, sidebar navigation, header UX, and the AI chat panel.

---

## 1. Unified Activity Bar (Canva-Style Sidebar)

### What Changed
The previous dual-sidebar layout (Projects sidebar + Left sidebar) has been replaced with a single unified, vertical **Activity Bar**.

### Features
- A **60px wide leftmost bar** hosts all primary navigation icons:
  - 📁 **Files Explorer** — browse project files
  - 🗂️ **Layers** — manage z-index ordering
  - ⬛ **Shapes** — drag shapes onto the canvas
  - 📐 **Templates** — apply diagram templates
  - ⚙️ **Settings** — canvas background & display settings
  - 👤 **Profile Avatar** — personal settings and logout
- **Click-to-pin behaviour:** Clicking any icon pins the drawer panel open at that section. Clicking the same icon again collapses it.
- **Hover-to-preview:** Hovering expands a sliding drawer panel without pinning.
- **Active highlight indicator:** A blue vertical bar on the left edge marks the currently active tab.

---

## 2. Embedded Canvas Settings Panel

### What Changed
Canvas settings (background color) were previously in a floating modal popup.

### Features
- Canvas settings are now **directly embedded** inside the sliding drawer panel under the **Settings** tab.
- **Preset colors:** 8 preset background swatches including dark, light, solarized and high-contrast themes.
- **Custom color picker:** Select any custom hex color using the native browser color picker.
- Changes apply to the canvas **in real time**, no save button required.

---

## 3. Interactive Project Path Breadcrumbs

### What Changed
The header previously showed a static text label like `Drafts / Interactive Diagram`.

### Features
- The **project name** in the breadcrumb path is now clickable — clicking it navigates back to the main Dashboard.
- The **file name** is now editable inline:
  - Click the file name to enter edit mode (an input field appears).
  - Press **Enter** or click away to save the new name.
  - Press **Escape** to cancel and revert.
- Uses hover styling and transitions for a polished feel.

---

## 4. Responsive Flex Header

### What Changed
The header layout was refactored from a fixed three-column CSS grid to a modern responsive `flexbox` layout.

### Features
- Eliminates fixed-width column constraints.
- All header sections (breadcrumbs, toolbar, quick actions) scale and distribute naturally.
- Cleaner separation between left, center, and right zones.
- Profile icon removed from the header — relocated to the Activity Bar.

---

## 5. Markdown Rich Text in Shapes

### What Changed
Shape text content previously rendered as plain strings.

### Features
- All shape types now support **inline Markdown-style text formatting** via a `parseMarkdown()` function in `ShapeRenderers.tsx`.
- Supported syntax:
  | Syntax | Output |
  |---|---|
  | `**bold**` | **bold** |
  | `*italic*` | *italic* |
  | `_italic_` | *italic* |
  | `` `code` `` | `inline code` |
  | Newlines | Line breaks inside the shape |
- Works across all shape types: rectangles, UML classes, cylinders, clouds, badges, callouts, etc.

---

## 6. Double-Click Inline Shape Editing

### What Changed
Previously, shape text content required using a separate panel or modal.

### Features
- **Double-clicking any shape** (in select mode) opens an inline glassmorphism overlay textarea directly on the shape.
- Text typed in the overlay replaces the shape's content on:
  - **Enter** (single press) — saves and closes the editor.
  - **Blur** (click away) — saves and closes the editor.
  - **Escape** — cancels and discards changes.
- The textarea matches the font size and text alignment of the shape for a WYSIWYG feel.

---

## 7. Canvas Quick Add Popup

### What Changed
Adding shapes previously required either dragging from the sidebar or using the top toolbar.

### Features
- **Double-clicking empty canvas space** (in select mode) opens a contextual floating popup menu at cursor position.
- The popup offers **6 quick-add shapes:**
  - Rectangle
  - Ellipse
  - Diamond
  - Arrow
  - Sticky Note
  - UML Class (Custom Block)
- Selecting a shape adds it to the canvas at the double-click coordinates.
- The popup appears with a subtle **scale-in animation** and dismisses on outside click.

---

## 8. Connector Port Snap Visual Indicator

### What Changed
Drawing connectors (lines/arrows) required manually targeting anchor dots, which had no active visual feedback.

### Features
- When the **line or arrow tool is active**, moving the cursor near any shape's anchor port (top, bottom, left, right) triggers a **pulsing blue ring** overlay at that port.
- The pulse animation visually guides the user to snap precisely to the connection point.
- Works with all standard shape types on the canvas.
- Port proximity radius is `24px` in canvas coordinates.

---

## Files Modified

| File | Change |
|---|---|
| `frontend/src/App.tsx` | Unified Activity Bar, click-to-pin logic, Settings tab |
| `frontend/src/components/layout/Header.tsx` | Interactive breadcrumbs, inline file rename |
| `frontend/src/components/layout/Header.module.css` | Flex-based layout |
| `frontend/src/components/layout/LeftSidebar.tsx` | Embedded canvas settings controls |
| `frontend/src/features/diagram/components/Canvas.tsx` | Quick Add popup, port snap indicator, double-click handler |
| `frontend/src/features/diagram/components/Canvas.module.css` | Animation keyframes |
| `frontend/src/features/diagram/components/Node.tsx` | Double-click inline editing textarea |
| `frontend/src/features/diagram/components/ShapeRenderers.tsx` | `parseMarkdown()` function, rich text content rendering |

---

## Next Planned Features

- **Vector (SVG) Export Engine** — high-fidelity SVG export for use in presentations and documents.
- **Mini Map Overview HUD** — a picture-in-picture canvas overview for large diagrams.
- **Inline AI Quick Commands** — spark icon on selected shapes for in-canvas AI actions.
