// Sphere Starter
sphere_diameter = 30;
flatten_bottom = true;
flat_trim = 2.6;
add_equator_ring = true;
ring_thickness = 2.4;

$fn = $preview ? 32 : 72;

module sphere_body() {
  if (flatten_bottom) {
    difference() {
      sphere(d = sphere_diameter);
      translate([0, 0, -sphere_diameter / 2 - flat_trim]) {
        cube([sphere_diameter * 2, sphere_diameter * 2, sphere_diameter], center = true);
      }
    }
  } else {
    sphere(d = sphere_diameter);
  }
}

module equator_ring() {
  rotate_extrude(convexity = 8) {
    translate([sphere_diameter * 0.52, 0, 0]) square([ring_thickness, ring_thickness], center = true);
  }
}

color("Gainsboro") {
  union() {
    sphere_body();
    if (add_equator_ring) equator_ring();
  }
}
