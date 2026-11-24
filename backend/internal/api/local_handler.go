package api

import (
	"net"
	"net/http"
	"net/url"
	"strings"
)

// LocalHandler prevents unrelated websites and DNS-rebinding hosts from using
// the unauthenticated loopback development API to write local inventory.
func (a *API) LocalHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if parsed, _, err := net.SplitHostPort(host); err == nil {
			host = parsed
		}
		if !localHostname(host) {
			http.Error(w, "Local API requests only", http.StatusForbidden)
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" {
			parsed, err := url.Parse(origin)
			if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || !localHostname(parsed.Hostname()) {
				http.Error(w, "Untrusted browser origin", http.StatusForbidden)
				return
			}
		}
		a.router.ServeHTTP(w, r)
	})
}
func localHostname(host string) bool {
	host = strings.TrimSuffix(strings.ToLower(host), ".")
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
