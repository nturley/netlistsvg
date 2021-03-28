`include "muxcy.v"
`include "xorcy.v"

module CARRY4BITS(output [3:0] CO, O, input CI, CYINIT, input [3:0] DI, S);
   wire CIN = CI | CYINIT;

   MUXCY muxcy0 (.O(CO[0]), .CI(CIN),   .DI(DI[0]), .S(S[0]));
   MUXCY muxcy1 (.O(CO[1]), .CI(CO[0]), .DI(DI[1]), .S(S[1]));
   MUXCY muxcy2 (.O(CO[2]), .CI(CO[1]), .DI(DI[2]), .S(S[2]));
   MUXCY muxcy3 (.O(CO[3]), .CI(CO[2]), .DI(DI[3]), .S(S[3]));

   XORCY xorcy0 (.O(O[0]), .CI(CIN),   .LI(S[0]));
   XORCY xorcy1 (.O(O[1]), .CI(CO[0]), .LI(S[1]));
   XORCY xorcy2 (.O(O[2]), .CI(CO[1]), .LI(S[2]));
   XORCY xorcy3 (.O(O[3]), .CI(CO[2]), .LI(S[3]));
endmodule
