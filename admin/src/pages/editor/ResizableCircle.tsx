import Draggable from "react-draggable";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

type Props = {
    x: number;
    y: number;
    size: number; // diameter in pixels
    onMove: (x: number, y: number) => void;
    onResize: (newSize: number) => void;
    children: ReactNode;
};

export default function ResizableCircle({
    x,
    y,
    size,
    onMove,
    onResize,
    children,
}: Props) {
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startSize = size;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            // Calculate distance from center to mouse
            const dx = moveEvent.clientX - centerX;
            const dy = moveEvent.clientY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // New size is 2x the distance (radius to diameter)
            let newSize = Math.round(distance * 2);

            // Constrain size
            newSize = Math.max(64, Math.min(400, newSize));

            onResize(newSize);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    return (
        <Draggable
            nodeRef={nodeRef}
            bounds={false}
            position={{ x, y }}
            onStop={(_, data) => onMove(data.x, data.y)}
        >
            <div
                ref={nodeRef}
                className="absolute cursor-move select-none"
                style={{ width: size, height: size }}
            >
                {children}

                {/* Resize Handle - Bottom Right Corner */}
                <div
                    onMouseDown={handleResizeStart}
                    className="absolute bottom-0 right-0 w-6 h-6 bg-[var(--viro-primary)] rounded-full border-2 border-white cursor-nwse-resize hover:scale-110 transition-transform shadow-lg"
                    style={{
                        transform: 'translate(50%, 50%)',
                    }}
                >
                    <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                    </div>
                </div>

                {/* Size indicator when resizing */}
                {isResizing && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
                        {size}px
                    </div>
                )}
            </div>
        </Draggable>
    );
}
