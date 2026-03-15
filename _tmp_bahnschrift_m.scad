module glyph_2d() {
  text("M", size = 88, font = "Bahnschrift:style=Bold", halign = "center", valign = "center");
}
linear_extrude(height = 8) glyph_2d();
