// Hyperboloid Lantern — Forge3D Math Lab (MIT)
// Lesson: straight rods can trace a curved, doubly ruled surface.
// Join equal-radius circles with an angular offset. The waist radius is
// R*cos(twist/2), even though every rod is straight. Opposite twists form
// the two crossing families. Try 60 and 130 degrees to compare the waist.
// Decorative shell only; this example does not specify lighting hardware.

// @param height = 70 // min: 45, max: 100, step: 5, label: Height
height = 70;
// @param radius = 27 // min: 20, max: 36, step: 1, label: Ring radius
radius = 27;
// @param twist = 110 // min: 60, max: 130, step: 5, label: Rod twist
twist = 110;
// @param rod_count = 20 // min: 12, max: 28, step: 2, label: Rods per family
rod_count = 20;
// @param rod_radius = 1.2 // min: 0.8, max: 1.8, step: 0.1, label: Rod radius
rod_radius = 1.2;

function polar(a,z) = [radius*cos(a), radius*sin(a), z];
module rod(a,b) {
    v = b-a;
    // Align a Z-axis cylinder with v using its polar and azimuth angles.
    // Offset the polygon phase to avoid coincident faces at rod crossings.
    translate(a) rotate([0,acos(v.z/norm(v)),atan2(v.y,v.x)])
        rotate([0,0,7]) cylinder(h=norm(v), r=rod_radius, $fn=16);
}
module rim() {
    difference() {
        cylinder(r=radius+2.5, h=3, $fn=120);
        translate([0,0,-0.1]) cylinder(r=radius-2.5, h=3.2, $fn=120);
    }
}
rim();
translate([0,0,height-3]) rim();
for (direction=[-1,1], i=[0:rod_count-1])
    rod(polar(360*i/rod_count,1.5),
        polar(360*i/rod_count+direction*twist,height-1.5));
