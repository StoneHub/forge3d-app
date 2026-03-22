// Shape Starter
// Forge3D curated learning example

$fn = $preview ? 28 : 72;

shape = "all"; // all | cube | tetrahedron | octahedron | cylinder | sphere | torus | twisted_prism | star_lantern
scale_factor = 1;
layout_spacing = 42;

function polar_point(radius, angle_deg) = [radius * cos(angle_deg), radius * sin(angle_deg)];

module cube_shape() {
  cube([24, 24, 24], center = true);
}

module tetrahedron_shape() {
  polyhedron(
    points = [
      [0, 0, 20],
      [-16, -9.2, -10],
      [16, -9.2, -10],
      [0, 18.4, -10]
    ],
    faces = [
      [0, 1, 2],
      [0, 2, 3],
      [0, 3, 1],
      [1, 3, 2]
    ]
  );
}

module octahedron_shape() {
  polyhedron(
    points = [
      [0, 0, 20],
      [20, 0, 0],
      [0, 20, 0],
      [-20, 0, 0],
      [0, -20, 0],
      [0, 0, -20]
    ],
    faces = [
      [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
      [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]
    ]
  );
}

module cylinder_shape() {
  cylinder(h = 28, d = 22, center = true);
}

module sphere_shape() {
  sphere(d = 28);
}

module torus_shape() {
  rotate_extrude(convexity = 10) {
    translate([16, 0, 0]) circle(d = 7);
  }
}

module twisted_prism_shape() {
  linear_extrude(height = 30, twist = 126, slices = 48, center = true) {
    polygon(points = [for (i = [0 : 5]) polar_point(i % 2 == 0 ? 14 : 10, i * 60)]);
  }
}

module star_lantern_shape() {
  linear_extrude(height = 34, twist = 180, scale = 0.55, slices = 54, center = true) {
    polygon(points = [for (i = [0 : 11]) polar_point(i % 2 == 0 ? 15 : 8, i * 30)]);
  }
}

module shape_model(kind = "cube") {
  if (kind == "cube") cube_shape();
  else if (kind == "tetrahedron") tetrahedron_shape();
  else if (kind == "octahedron") octahedron_shape();
  else if (kind == "cylinder") cylinder_shape();
  else if (kind == "sphere") sphere_shape();
  else if (kind == "torus") torus_shape();
  else if (kind == "twisted_prism") twisted_prism_shape();
  else if (kind == "star_lantern") star_lantern_shape();
}

module shape_lineup() {
  shapes = [
    "tetrahedron",
    "cube",
    "octahedron",
    "cylinder",
    "sphere",
    "torus",
    "twisted_prism",
    "star_lantern"
  ];

  for (index = [0 : len(shapes) - 1]) {
    row = floor(index / 4);
    col = index % 4;
    translate([
      (col - 1.5) * layout_spacing,
      (0.5 - row) * layout_spacing,
      0
    ]) shape_model(shapes[index]);
  }
}

color("Gainsboro")
scale([scale_factor, scale_factor, scale_factor]) {
  if (shape == "all") shape_lineup();
  else shape_model(shape);
}
