// Impossible Ring Study
// Forge3D curated example inspired by Jeff Barr's MIT collection.

$fn = $preview ? 28 : 56;

layer_count = 3;
inner_radius = 24;
ring_thickness = 7;
ring_height = 3.2;
layer_spacing = 13;
ring_sweep = 302;
layer_twist = 16;
connector_radius = 2.4;
connector_angles = [138, 222, 300];

module ring_segment(radius, thickness, height, sweep) {
  rotate([0, 0, -sweep / 2]) {
    rotate_extrude(angle = sweep, convexity = 10) {
      translate([radius, 0, 0]) square([thickness, height], center = false);
    }
  }
}

module layer(index) {
  rotate([0, 0, index * layer_twist]) {
    translate([0, 0, index * layer_spacing]) ring_segment(inner_radius, ring_thickness, ring_height, ring_sweep);
  }
}

module connector_post(angle_deg) {
  mean_radius = inner_radius + ring_thickness * 0.58;
  translate([mean_radius * cos(angle_deg), mean_radius * sin(angle_deg), ring_height * 0.3]) {
    cylinder(h = (layer_count - 1) * layer_spacing + ring_height * 0.7, r = connector_radius);
  }
}

color("Gainsboro") {
  union() {
    for (index = [0 : layer_count - 1]) {
      layer(index);
    }
    for (angle_deg = connector_angles) {
      connector_post(angle_deg);
    }
  }
}
