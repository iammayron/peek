.PHONY: icons build test install dev

icons:
	go run ./tools/genicons extension/icons

build: icons
	go build -o bin/inspectai ./cmd/inspectai

test:
	go test ./...

install: build
	./bin/inspectai install --dev

dev: install
	./bin/inspectai doctor
