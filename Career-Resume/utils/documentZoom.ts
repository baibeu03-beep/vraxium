export const getDocumentZoom = (): number => {
  if (typeof window === "undefined") return 1;

  const zoomValue = getComputedStyle(document.documentElement).zoom;
  if (!zoomValue || zoomValue === "1" || zoomValue === "normal") return 1;

  const parsedZoom = parseFloat(zoomValue);
  return Number.isFinite(parsedZoom) && parsedZoom > 0 ? parsedZoom : 1;
};

export const getFixedDropdownPosition = (
  rect: Pick<DOMRect, "bottom" | "left" | "width">,
  topOffset: number = 0,
) => {
  const zoom = getDocumentZoom();
  const top = rect.bottom + topOffset;
  const left = rect.left;
  const width = rect.width;

  return zoom === 1
    ? { top, left, width }
    : { top: top / zoom, left: left / zoom, width: width / zoom };
};
