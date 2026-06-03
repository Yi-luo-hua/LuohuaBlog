package main

import "testing"

func TestNormalizeDisplayName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "trims whitespace", input: "  Tao  ", want: "Tao"},
		{name: "rejects blank", input: "   ", wantErr: true},
		{name: "rejects too long", input: "abcdefghijklmnop", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeDisplayName(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("normalizeDisplayName(%q) returned nil error", tt.input)
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeDisplayName(%q) returned error: %v", tt.input, err)
			}
			if got != tt.want {
				t.Fatalf("normalizeDisplayName(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
