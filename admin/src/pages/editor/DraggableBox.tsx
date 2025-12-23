import Draggable from "react-draggable";
import type { ReactNode } from "react";
import { useRef } from "react";

type Props = {
  x: number;
  y: number;
  onStop: (x: number, y: number) => void;
  children: ReactNode;
  bounds?: "parent" | false | { left: number; top: number; right: number; bottom: number };
  disabled?: boolean;
  onDrag?: (x: number, y: number) => void;
};

export default function DraggableBox({
  x,
  y,
  onStop,
  children,
  bounds = "parent",
  disabled = false,
  onDrag,
}: Props) {
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds={bounds}
      disabled={disabled}
      position={{ x, y }}
      onDrag={(_, data) => onDrag?.(data.x, data.y)}
      onStop={(_, data) => onStop(data.x, data.y)}
    >
      <div ref={nodeRef} className="absolute cursor-move select-none">
        {children}
      </div>
    </Draggable>
  );
}
