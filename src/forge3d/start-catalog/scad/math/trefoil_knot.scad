// Trefoil Knot — Forge3D Math Lab (MIT)
// Lesson: sweep a circular section along a parametric space curve.
// OpenSCAD trig uses degrees. Coprime winding counts (2, 3) make one knot.
// Try changing tube_radius; then inspect the frame and wrapped face indices.
// A sculpture study: choose orientation and supports before printing.

// @param major_radius = 24 // min: 20, max: 36, step: 1, label: Major radius
major_radius = 24;
// @param minor_radius = 9 // min: 7, max: 12, step: 0.5, label: Knot depth
minor_radius = 9;
// @param tube_radius = 2.4 // min: 1.2, max: 3.2, step: 0.2, label: Tube radius
tube_radius = 2.4;

function knot(t) = [
    (major_radius + minor_radius*cos(3*t))*cos(2*t),
    (major_radius + minor_radius*cos(3*t))*sin(2*t),
    minor_radius*sin(3*t) + minor_radius + tube_radius
];
function unit(v) = v / norm(v);
// Tangent T, sideways N, and binormal B form an orthonormal moving frame.
// Here the tangent never points straight up, so cross(T, Z) stays nonzero.
function ring_point(t, a) =
    let(T = unit(knot(t+0.01) - knot(t-0.01)),
        N = unit(cross(T, [0,0,1])), B = cross(T, N))
    knot(t) + tube_radius*(cos(a)*N + sin(a)*B);

module trefoil(steps=144, sides=16) {
    function index(i,j) = (i % steps)*sides + (j % sides);
    points = [for (i=[0:steps-1], j=[0:sides-1])
        ring_point(360*i/steps, 360*j/sides)];
    // Each quad is split into triangles; both index directions wrap closed.
    faces = [for (i=[0:steps-1], j=[0:sides-1]) each [
        [index(i,j), index(i+1,j), index(i+1,j+1)],
        [index(i,j), index(i+1,j+1), index(i,j+1)]
    ]];
    polyhedron(points=points, faces=faces, convexity=12);
}

trefoil();
