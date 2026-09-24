terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {
  host = "unix:///home/shinichi/.docker/desktop/docker.sock"
}

resource "docker_network" "devops" {
  name = "wastios-devops"
}

resource "docker_image" "sonarqube" {
  name = "sonarqube:community"
}

resource "docker_container" "sonarqube" {
  name  = "wastios-sonarqube"
  image = docker_image.sonarqube.image_id

  networks_advanced {
    name = docker_network.devops.name
  }

  ports {
    internal = 9000
    external = 9000
  }
}

resource "docker_image" "nexus" {
  name = "sonatype/nexus3:latest"
}

resource "docker_container" "nexus" {
  name  = "wastios-nexus"
  image = docker_image.nexus.image_id

  networks_advanced {
    name = docker_network.devops.name
  }

  # Nexus UI / REST API
  ports {
    internal = 8081
    external = 8081
  }

  # Docker-hosted registry repo (created manually in the UI, see devops/docs/DEVOPS.md)
  ports {
    internal = 8082
    external = 8082
  }
}

# Local stand-ins for Firebase (Firestore) and AWS S3 so the backend can boot
# end-to-end in the demo cluster without real cloud credentials.

resource "docker_image" "firestore_emulator" {
  name = "mtlynch/firestore-emulator:latest"
}

resource "docker_container" "firestore_emulator" {
  name  = "wastios-firestore-emulator"
  image = docker_image.firestore_emulator.image_id

  networks_advanced {
    name = docker_network.devops.name
  }

  env = [
    "FIRESTORE_PROJECT_ID=demo-wastios",
  ]

  ports {
    internal = 8080
    external = 8090
  }
}

resource "docker_image" "s3mock" {
  name = "adobe/s3mock:latest"
}

resource "docker_container" "s3mock" {
  name  = "wastios-s3mock"
  image = docker_image.s3mock.image_id

  networks_advanced {
    name = docker_network.devops.name
  }

  env = [
    "initialBuckets=wastios-images",
  ]

  ports {
    internal = 9090
    external = 9090
  }
}
