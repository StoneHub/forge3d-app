// Chess Pieces
// Forge3D curated example

$fn = $preview ? 20 : 48;

piece = "pawn"; // pawn | rook | knight | bishop | queen | king
scale_factor = 1;

module revolve_profile(points) {
  rotate_extrude(convexity = 12) polygon(points = points);
}

module base_stack(base_d = 26, base_h = 3.2, rim_d = 21, rim_h = 2.4, stem_d = 15, stem_h = 4) {
  union() {
    cylinder(h = base_h, d1 = base_d, d2 = base_d - 3);
    translate([0, 0, base_h]) cylinder(h = rim_h, d1 = rim_d, d2 = rim_d - 2);
    translate([0, 0, base_h + rim_h]) cylinder(h = stem_h, d1 = stem_d, d2 = stem_d - 2);
  }
}

module pawn_piece() {
  union() {
    base_stack();
    translate([0, 0, 9.6]) {
      revolve_profile([
        [0, 0],
        [6.8, 0],
        [8.0, 6],
        [6.5, 13],
        [4.4, 20],
        [3.8, 24],
        [0, 24]
      ]);
    }
    translate([0, 0, 35.2]) sphere(d = 11.4);
  }
}

module rook_piece() {
  union() {
    base_stack(base_d = 28, rim_d = 23, stem_d = 18);
    translate([0, 0, 9.6]) {
      revolve_profile([
        [0, 0],
        [8.0, 0],
        [8.4, 5],
        [7.5, 18],
        [8.8, 23],
        [8.8, 27],
        [0, 27]
      ]);
    }
    translate([0, 0, 36.6]) {
      difference() {
        cylinder(h = 7, d = 18);
        for (a = [0 : 90 : 270]) {
          rotate([0, 0, a]) translate([-2.1, 5.4, -0.2]) cube([4.2, 5.4, 7.4]);
        }
      }
    }
  }
}

module knight_head_profile() {
  polygon(points = [
    [-1.5, 0],
    [2, 0],
    [5, 5],
    [5.5, 11],
    [3.8, 17],
    [4.6, 24],
    [3.0, 31],
    [0.4, 36],
    [-2.0, 32],
    [-1.0, 24],
    [-2.8, 18],
    [-3.0, 10],
    [-1.5, 4]
  ]);
}

module knight_piece() {
  union() {
    base_stack(base_d = 28, rim_d = 22, stem_d = 17);
    translate([0, 0, 9.4]) {
      revolve_profile([
        [0, 0],
        [7.8, 0],
        [7.1, 4],
        [6.5, 10],
        [5.0, 15],
        [4.2, 18],
        [0, 18]
      ]);
    }
    translate([0, -5.6, 27.4]) rotate([90, 0, 0]) linear_extrude(height = 11.2, center = true) knight_head_profile();
    translate([0, -1.2, 46]) sphere(d = 3.2);
  }
}

module bishop_piece() {
  union() {
    base_stack(base_d = 27, rim_d = 21.5, stem_d = 15.5);
    translate([0, 0, 9.6]) {
      revolve_profile([
        [0, 0],
        [7.2, 0],
        [8.2, 5],
        [6.4, 16],
        [4.8, 23],
        [4.0, 29],
        [0, 29]
      ]);
    }
    translate([0, 0, 40.5]) {
      difference() {
        scale([1, 1, 1.24]) sphere(d = 12.2);
        rotate([0, 22, 0]) translate([-1.2, -6, -10]) cube([2.4, 12, 20]);
      }
    }
    translate([0, 0, 33.6]) cylinder(h = 5.5, d1 = 5.4, d2 = 7.4);
  }
}

module queen_piece() {
  union() {
    base_stack(base_d = 30, rim_d = 24, stem_d = 18.5);
    translate([0, 0, 9.6]) {
      revolve_profile([
        [0, 0],
        [8.8, 0],
        [10.5, 5],
        [7.8, 16],
        [5.8, 25],
        [6.0, 32],
        [7.8, 38],
        [0, 38]
      ]);
    }
    translate([0, 0, 47.6]) cylinder(h = 2.2, d = 13.5);
    translate([0, 0, 49.8]) {
      for (a = [0 : 60 : 300]) {
        rotate([0, 0, a]) translate([5.8, 0, 0]) sphere(d = 3.2);
      }
      sphere(d = 5.4);
    }
    translate([0, 0, 43.5]) difference() {
      cylinder(h = 4.5, d1 = 8.4, d2 = 12.6);
      cylinder(h = 4.8, d = 5.1);
    }
  }
}

module king_piece() {
  union() {
    base_stack(base_d = 31, rim_d = 24.5, stem_d = 19);
    translate([0, 0, 9.6]) {
      revolve_profile([
        [0, 0],
        [9.2, 0],
        [10.4, 6],
        [7.6, 18],
        [5.6, 29],
        [5.4, 37],
        [7.4, 42],
        [0, 42]
      ]);
    }
    translate([0, 0, 52]) {
      cylinder(h = 4, d = 8.2);
      translate([0, 0, 4]) cube([2.2, 2.2, 10], center = true);
      translate([0, 0, 9]) cube([8, 2, 2], center = true);
      translate([0, 0, 9]) cube([2, 8, 2], center = true);
    }
    translate([0, 0, 46.5]) difference() {
      cylinder(h = 5.4, d1 = 8.5, d2 = 13.2);
      cylinder(h = 5.7, d = 5.2);
    }
  }
}

module chess_piece(kind = "pawn") {
  if (kind == "pawn") pawn_piece();
  else if (kind == "rook") rook_piece();
  else if (kind == "knight") knight_piece();
  else if (kind == "bishop") bishop_piece();
  else if (kind == "queen") queen_piece();
  else if (kind == "king") king_piece();
}

color("Ivory")
scale([scale_factor, scale_factor, scale_factor]) {
  chess_piece(piece);
}
