export type VibraTemplate = {
  canvas: {
    width: number;
    height: number;
  };

  // ✅ NEW: base flyer background image (local for now)
  // Example: "/flyers/Lions.jpg"
  baseFlyerUrl?: string;

  body: {
    text: {
      x: number; // 0..1
      y: number; // 0..1
      font: string;
      color: string;
      content: string;
    };
  };

  photo: {
    x: number; // 0..1
    y: number; // 0..1
    size: number; // px
    shape: "circle" | "rect";
  };
};
