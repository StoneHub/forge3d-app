module glyph_2d() {
  text("M", size = 88, font = "Liberation Sans:style=Bold", halign = "center", valign = "center");
}
linear_extrude(height = 8) glyph_2d();
