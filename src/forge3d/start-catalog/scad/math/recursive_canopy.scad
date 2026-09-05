// Recursive Canopy — Forge3D Math Lab (MIT)
// Lesson: a module calls itself in three rotated coordinate frames.
// Depth d creates (3^d - 1)/2 branches: 4 levels = 40, 5 = 121.
// The decreasing length and radius are a geometric progression.
// Try changing spread and twist to grow a different silhouette.
// Branch overhangs need a deliberate orientation/support strategy to print.

// @param levels = 4 // min: 2, max: 5, step: 1, label: Branch levels
levels = 4;
// @param spread = 32 // min: 20, max: 45, step: 1, label: Branch spread
spread = 32;
// @param twist = 25 // min: 0, max: 60, step: 5, label: Branch twist
twist = 25;
// @param shrink = 0.7 // min: 0.6, max: 0.78, step: 0.02, label: Length ratio
shrink = 0.7;

module branch(depth, length, radius) {
    cylinder(h=length, r1=radius, r2=radius*0.65, $fn=16);
    translate([0,0,length]) {
        sphere(r=radius*0.65, $fn=16);
        if (depth > 1)
            for (a=[0:120:240])
                rotate([0,0,a+twist]) rotate([0,spread,0])
                    branch(depth-1, length*shrink, radius*0.65);
    }
}
cylinder(r=15, h=3, $fn=72);
translate([0,0,2]) branch(levels, 25, 3.8);
