
.PHONY: all
all:
	go get github.com/saurick/entimport/cmd/entimport
	go run github.com/saurick/entimport/cmd/entimport \
  -dsn "mysql://root:YP*H%k%a7xK1*q@tcp(192.168.0.106:3306)/test_database_atlas?charset=utf8mb4&parseTime=True&loc=Local&interpolateParams=true" \
  -schema-path ./schema

	rm -rf ent
	go generate
	# go mod tidy
