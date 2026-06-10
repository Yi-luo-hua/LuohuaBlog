package main

import "testing"

func TestTryRunSyncJobSkipsWhileAnotherSyncIsRunning(t *testing.T) {
	syncRunning.Store(false)
	t.Cleanup(func() { syncRunning.Store(false) })

	firstStarted := tryRunSyncJob(func() {
		if tryRunSyncJob(func() {
			t.Fatal("nested sync job should not run")
		}) {
			t.Fatal("nested sync job should report skipped")
		}
	})

	if !firstStarted {
		t.Fatal("first sync job should start")
	}
}

func TestTryRunSyncJobReleasesLockAfterRun(t *testing.T) {
	syncRunning.Store(false)
	t.Cleanup(func() { syncRunning.Store(false) })

	if !tryRunSyncJob(func() {}) {
		t.Fatal("first sync job should start")
	}
	if !tryRunSyncJob(func() {}) {
		t.Fatal("second sync job should start after first finishes")
	}
}
