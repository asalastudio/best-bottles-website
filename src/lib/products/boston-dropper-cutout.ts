/** Remove detached white cutout scraps from specific legacy 15 ml Boston layers.
 * Coordinates are in the original 1000 x 1100 canvas; the bottle and closure
 * silhouettes are retained. Other assets must not inherit this mask. */
export function bostonDropperCutout(url: string): string | undefined {
    if (/\/(?:c67d14d5d51b63deaed9cdefb0a5e40c41edeb2743e308cd405538b8bd318c5b|c360eb9151d02cbcaa3bd27a6971085c7f41af17b25570f27e336c1a21489df6|eed3046cd34adfac7f1f89027a5f897e0c90910981ca06a5e181244a8bfb3941)\.body\.webp(?:\?.*)?$/.test(url))
        return "polygon(37% 0%, 64% 0%, 64% 41%, 66% 46%, 66% 100%, 35% 100%, 35% 46%, 37% 41%)";
    if (/\/c0c76896a877c4751fff0f109ea931633bc6b265020888afb93a6c704e6ab1f6\.fitment\.webp(?:\?.*)?$/.test(url))
        return "polygon(43% 0%, 57% 0%, 57% 22%, 62% 22%, 62% 35%, 38% 35%, 38% 22%, 43% 22%)";
    return undefined;
}
