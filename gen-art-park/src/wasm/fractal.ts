// Mandelbrot set rendering in AssemblyScript

// We will write to a buffer in memory. The JS side will read this buffer.
// We assume a linear buffer of ARGB pixels.

export function render(width: i32, height: i32, zoom: f64, panX: f64, panY: f64, maxIter: i32): void {
    // Pointer to the start of the image buffer (assuming it starts at 0, or we can export a getter)
    // In AS, memory 0 is often reserved, but for simple script we can just allow writing from offset.
    // We'll trust the host to manage memory or assume output buffer starts at a known offset.
    // Ideally, passing a pointer is better.

    // Let's adhere to a convention: output buffer starts at address 0 for simplicity in this demo,
    // or we can use `store<i32>(offset, color)`.

    let offset: i32 = 0;

    for (let y: i32 = 0; y < height; y++) {
        for (let x: i32 = 0; x < width; x++) {

            let cy: f64 = (y - height / 2.0) / (0.5 * zoom * height) + panY;
            let cx: f64 = (x - width / 2.0) / (0.5 * zoom * height) + panX; // maintain aspect ratio based on height

            let zx: f64 = 0.0;
            let zy: f64 = 0.0;
            let i: i32 = 0;

            while (zx * zx + zy * zy < 4.0 && i < maxIter) {
                let temp: f64 = zx * zx - zy * zy + cx;
                zy = 2.0 * zx * zy + cy;
                zx = temp;
                i++;
            }

            // Color mapping
            let color: i32 = 0xFF000000;
            if (i < maxIter) {
                // Simple distinct coloring
                // ARGB format
                const c: i32 = <i32>(i * 255 / maxIter);
                // color = 0xFF000000 | (c << 16) | (c << 8) | c; // grayscale

                // Pretty colors
                let r: i32 = (i * 9) % 255;
                let g: i32 = (i * 3) % 255;
                let b: i32 = (i * 5) % 255;

                color = 0xFF000000 | (r << 16) | (g << 8) | b;
            } else {
                color = 0xFF000000; // Black
            }

            store<i32>(offset, color);
            offset += 4;
        }
    }
}

export const Int32Array_ID = idof<Int32Array>();
