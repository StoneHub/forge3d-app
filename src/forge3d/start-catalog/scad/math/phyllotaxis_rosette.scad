// Phyllotaxis Rosette — Forge3D Math Lab (MIT)
// Lesson: golden-angle rotation and square-root growth distribute seeds.
// Equal increments of i occupy equal annular areas because area ~ r^2.
// Compare 137.508 degrees with 135 or 144 to reveal radial spokes.

// @param seed_count = 120 // min: 40, max: 180, step: 10, label: Seed count
seed_count = 120;
// @param radius = 36 // min: 24, max: 48, step: 2, label: Disc radius
radius = 36;
// @param angle_offset = 0 // min: -5, max: 7, step: 0.5, label: Angle offset
angle_offset = 0;
// @param relief = 4 // min: 2, max: 7, step: 0.5, label: Seed height
relief = 4;

module rosette() {
    golden_angle = 180*(3-sqrt(5));
    spacing = radius/sqrt(seed_count);
    cylinder(r=radius+spacing*1.3, h=2, $fn=120);
    for (i=[0:seed_count-1]) {
        angle = i*(golden_angle+angle_offset);
        r = radius*sqrt((i+0.5)/seed_count);
        h = relief*(1-0.35*i/seed_count);
        rotate([0,0,angle]) translate([r,0,2+h/2-0.5])
            scale([spacing*1.05, spacing*0.62, h/2]) sphere(r=1, $fn=16);
    }
}
rosette();
