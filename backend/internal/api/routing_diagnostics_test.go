package api

import "testing"

func TestValidBGPResourceAcceptsIPsAndPrefixes(t *testing.T) {
	for _, input := range []string{"8.8.8.8", "2001:4860:4860::8888", "8.8.8.0/24", "2001:4860::/32"} {
		if !validBGPResource(input) {
			t.Errorf("validBGPResource(%q) = false, want true", input)
		}
	}
}

func TestValidBGPResourceRejectsHostsAndMalformedPrefixes(t *testing.T) {
	for _, input := range []string{"example.com", "8.8.8.8:443", "8.8.8.0/33", "", "--help"} {
		if validBGPResource(input) {
			t.Errorf("validBGPResource(%q) = true, want false", input)
		}
	}
}
