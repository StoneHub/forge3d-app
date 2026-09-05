// Wave Interference — Forge3D Math Lab (MIT)
// Lesson: sample the sum of two radial waves into a watertight height field.
// Peaks reinforce where the waves agree; they cancel where phases differ.
// Every cell has two triangles. A reversed floor and perimeter close the mesh.
// Try phase=180, then change wavelength to move the interference bands.

// @param amplitude = 5 // min: 2, max: 8, step: 0.5, label: Relief amplitude
amplitude = 5;
// @param wavelength = 22 // min: 14, max: 36, step: 1, label: Wavelength
wavelength = 22;
// @param phase = 0 // min: 0, max: 360, step: 15, label: Phase degrees
phase = 0;
// @param separation = 30 // min: 10, max: 50, step: 2, label: Source separation
separation = 30;

function wave(x,y) = 3 + amplitude*(1 +
    0.45*cos(360*norm([x-separation/2,y])/wavelength) +
    0.45*cos(360*norm([x+separation/2,y])/wavelength+phase));

module wave_tile(nx=64, ny=48, width=80, depth=60) {
    function at(x,y) = y*(nx+1)+x;
    count = (nx+1)*(ny+1);
    top = [for (y=[0:ny], x=[0:nx])
        let(px=width*(x/nx-0.5), py=depth*(y/ny-0.5))
        [px,py,wave(px,py)]];
    floor_points = [for (p=top) [p.x,p.y,0]];
    // Clockwise as seen from outside is OpenSCAD's face convention.
    top_faces = [for (y=[0:ny-1], x=[0:nx-1])
        let(a=at(x,y), b=at(x+1,y), c=at(x,y+1), d=at(x+1,y+1))
        each [[a,c,b], [b,c,d]]];
    floor_faces = [for (f=top_faces) [f[2]+count,f[1]+count,f[0]+count]];
    edge = concat([for (x=[0:nx-1]) at(x,0)],
        [for (y=[0:ny-1]) at(nx,y)],
        [for (x=[nx:-1:1]) at(x,ny)],
        [for (y=[ny:-1:1]) at(0,y)]);
    sides = [for (i=[0:len(edge)-1])
        let(a=edge[i], b=edge[(i+1)%len(edge)])
        each [[a,b,b+count], [a,b+count,a+count]]];
    polyhedron(points=concat(top,floor_points),
        faces=concat(top_faces,floor_faces,sides), convexity=10);
}
wave_tile();
