"use client";

import { useCallback, useState, type DragEvent } from "react";

// Custom MIME type carrying the dragged document's id. Scoped to this app so
// dropping foreign content (files, browser links) never accidentally moves a
// document.
export const DOCUMENT_DRAG_MIME = "application/x-anvilnote-document-id";

/** Spread onto a draggable document row (sidebar list, /projects expanded list). */
export function documentDragProps(documentId: string) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(DOCUMENT_DRAG_MIME, documentId);
      event.dataTransfer.effectAllowed = "move";
    },
  };
}

/**
 * Drop-target behavior for a project row: accepts a dragged document id and
 * calls `onDropDocument`. `isOver` drives a hover-style highlight while a
 * compatible drag is over the target.
 */
export function useProjectDropTarget(onDropDocument: (documentId: string) => void) {
  const [isOver, setIsOver] = useState(false);

  const onDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(DOCUMENT_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDragEnter = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(DOCUMENT_DRAG_MIME)) return;
    setIsOver(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent) => {
    // Moving between child elements re-fires dragleave/dragenter; only clear
    // the highlight once the pointer actually exits this element's subtree.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsOver(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      const documentId = event.dataTransfer.getData(DOCUMENT_DRAG_MIME);
      event.preventDefault();
      setIsOver(false);
      if (documentId) onDropDocument(documentId);
    },
    [onDropDocument],
  );

  return { isOver, dropHandlers: { onDragOver, onDragEnter, onDragLeave, onDrop } };
}
