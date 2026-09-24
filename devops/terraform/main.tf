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
