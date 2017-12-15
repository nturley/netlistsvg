module DFF (output reg Q, input C, D, R);
	always @(posedge C)
		if (~R) begin
			Q <= 1'b0;
		end else begin
			Q <= D;
		end
endmodule
