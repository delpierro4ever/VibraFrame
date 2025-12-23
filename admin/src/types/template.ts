export type Template = {
  /**
   * Output canvas size.
   * We standardize on 1080×1080 for consistent export + rendering.
   */
  canvas: { width: number; height: number };

  /**
   * Photo placeholder
   * x/y are normalized (0..1) center coordinates in canvas space.
   * size is DIAMETER in pixels in OUTPUT canvas space (1080-based).
   */
  photo: {
    x: number; // 0..1 center
    y: number; // 0..1 center
    size: number; // px diameter (1080-space)
    shape: "circle" | "square";
  };

  /**
   * Name placeholder + text style
   * x/y are normalized (0..1) center coordinates in canvas space.
   * w/h are normalized fractions of the canvas.
   * size is font size in pixels in OUTPUT canvas space (1080-based).
   */
  text: {
    x: number; // 0..1 center
    y: number; // 0..1 center
    w: number; // 0..1 box width
    h: number; // 0..1 box height
    content?: string;
    font?: string; // optional for now; can default in renderer
    color: string;
    size: number; // px font size (1080-space)
  };

  /**
   * Background storage path (Supabase Storage path, not public URL).
   * Example: events/<eventId>/background/original.jpg
   */
  background?: { url?: string };
};
