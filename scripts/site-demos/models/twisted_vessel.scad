// Twisted superformula vessel
// @param height = 64 // min: 40, max: 90, step: 2, label: Height
height = 64;
// @param lobes = 6 // min: 3, max: 10, step: 1, label: Lobes
lobes = 6;
// @param twist = 90 // min: 0, max: 180, step: 5, label: Twist degrees
twist = 90;
// @param flare = 1.3 // min: 0.6, max: 1.8, step: 0.05, label: Top flare
flare = 1.3;
// @param wall = 2 // min: 1, max: 4, step: 0.2, label: Wall
wall = 2;

function r(a) = 26 * pow(pow(abs(cos(lobes*a/4)), 1.3) + pow(abs(sin(lobes*a/4)), 1.3), -1/0.7);
module profile() polygon([for (a = [0:3:357]) [r(a)*cos(a), r(a)*sin(a)]]);

linear_extrude(height = height, twist = twist, slices = 48, scale = flare)
  difference() { profile(); offset(delta = -wall) profile(); }
