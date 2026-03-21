// Chess Pawn
// Forge3D curated example

$fn = $preview ? 40 : 96;

base_diameter = 28;
base_height = 4;
body_height = 30;
body_max_diameter = 18;
neck_diameter = 11;
head_diameter = 15;

module profile_points() {
  polygon(points = [
    [0, 0],
    [base_diameter / 2, 0],
    [base_diameter / 2 - 1.5, base_height],
    [body_max_diameter / 2 + 1.5, base_height + 2],
    [body_max_diameter / 2, base_height + 14],
    [neck_diameter / 2 + 1.5, base_height + body_height - 7],
    [neck_diameter / 2, base_height + body_height - 2],
    [head_diameter / 2 - 1, base_height + body_height + 3],
    [head_diameter / 2, base_height + body_height + 7],
    [0, base_height + body_height + 7],
  ]);
}

color("Ivory")
rotate_extrude(convexity = 10)
profile_points();
