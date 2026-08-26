package main

import (
	"net/http"
)

// currentUser used to describe a signed-in account. Accounts are gone, so the
// only caller it still serves is the guestbook's moderation check: either the
// request carries an owner session or it is an ordinary anonymous visitor.
type currentUser struct {
	ID       int64
	Email    string
	Nickname string
	Avatar   string
	Role     string // "admin" for the owner
}

func getCurrentUserFromRequest(r *http.Request) *currentUser {
	if !isOwnerRequest(r) {
		return nil
	}
	return &currentUser{
		Nickname: ownerDisplayName(),
		Role:     "admin",
	}
}

func isAdminUser(u *currentUser) bool {
	return u != nil && u.Role == "admin"
}
