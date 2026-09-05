// Superformula Vessel — Forge3D Math Lab (MIT)
// Lesson: a polar equation becomes a polygon, then a twisted hollow solid.
// r(a) = (|cos(m*a/4)|^n2 + |sin(m*a/4)|^n3)^(-1/n1).
// With n2=n3=2 the outline is a circle. Smaller powers reveal the lobes.
// Try twist=0 to compare the 2D profile with the helical vessel.

// @param height = 64 // min: 40, max: 90, step: 2, label: Height
height = 64;
// @param lobes = 6 // min: 4, max: 10, step: 2, label: Lobes
lobes = 6;
// @param twist = 90 // min: 0, max: 180, step: 15, label: Twist degrees
twist = 90;
// @param exponent = 1.3 // min: 1, max: 2, step: 0.1, label: Shape exponent
exponent = 1.3;
// @param wall = 2 // min: 1.2, max: 3, step: 0.2, label: Wall offset
wall = 2;

function radius(a) = 26 * pow(
    pow(abs(cos(lobes*a/4)), exponent) +
    pow(abs(sin(lobes*a/4)), exponent), -1/0.7);
module profile() {
    polygon([for (a=[0:2:358]) [radius(a)*cos(a), radius(a)*sin(a)]]);
}
module vessel() {
    base = 3;
    difference() {
        linear_extrude(height=height, twist=twist, slices=96, convexity=10)
            profile();
        // Positive linear_extrude twist turns clockwise. Start the cavity
        // at the same angle as the outer wall at z=base, with equal pitch.
        translate([0,0,base]) rotate([0,0,-twist*base/height])
            linear_extrude(height=height-base+0.1,
                twist=twist*(height-base+0.1)/height, slices=96, convexity=10)
                offset(delta=-wall) profile();
    }
}
vessel();
