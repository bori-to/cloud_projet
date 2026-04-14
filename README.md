# Projet Cloud

## Objectif

Déployer une application web sur AWS avec une architecture simple,
cohérente et conforme au sujet :

-   4 services Cloud minimum
-   1 service serverless
-   Application accessible en ligne

------------------------------------------------------------------------

## Architecture

### Services utilisés

  Service                 Rôle
  ----------------------- -----------------------------------------------
  EC2                     Hébergement de l'application (Docker Compose)
  S3                      Stockage des sauvegardes PostgreSQL
  Lambda                  Déclenchement du backup
  EventBridge Scheduler   Planification automatique

------------------------------------------------------------------------

## ⚙️ Déploiement EC2

### 1. Création instance

-   Ubuntu 22.04
-   t3.micro
-   Ports ouverts :
    -   22 (SSH)
    -   80 (frontend)
    -   3000 (API)
    -   8080 (Adminer)

### 2. Connexion

``` bash
ssh -i quartissimo-key.pem ubuntu@IP
```

### 3. Installation

``` bash
# Add Docker's official GPG key:
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update

sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 4. Projet

``` bash
git clone https://github.com/bori-to/cloud_projet.git cloud
cd cloud/dev/src
docker compose up -d --build
```

------------------------------------------------------------------------

## S3 (Backup)

### Création bucket

-   Nom : quartissimo-612782034056-eu-west-1-an 
-   Région : eu-west-1
-   Versioning activé

------------------------------------------------------------------------

## Lambda

### Rôle

Appelle l'API `/backups`

### Variables

    BACKUP_URL=http://IP_EC2:3000/backups
    BACKUP_SECRET=backups

### Code

``` python
import os
import urllib.request

def handler(event, context):
    url = os.environ["BACKUP_URL"]
    secret = os.environ["BACKUP_SECRET"]

    req = urllib.request.Request(
        url=url,
        method="POST",
        headers={
            "x-backup-secret": secret
        }
    )

    with urllib.request.urlopen(req) as response:
        return {
            "statusCode": response.status,
            "body": response.read().decode()
        }
```

------------------------------------------------------------------------

## ⏱️ EventBridge Scheduler

### Configuration

-   Type : Recurring
-   Cron : cron(0 3 ? * SUN *)

-   Timezone : Europe/Paris
-   Target : Lambda

------------------------------------------------------------------------

## Endpoint `/backups`

### Sécurité

Header requis :

    x-backup-secret: backups

### Fonctionnement

1.  Dump PostgreSQL
2.  Upload vers S3
3.  Retour JSON

------------------------------------------------------------------------

## Tests

-   Accès app : http://IP
-   Test Lambda manuel
-   Vérification fichiers dans S3

------------------------------------------------------------------------

## Présentation orale

> L'application est hébergée sur EC2 via Docker. Une Lambda déclenche un
> endpoint sécurisé `/backups`. Les sauvegardes PostgreSQL sont stockées
> dans S3. EventBridge automatise ce processus chaque semaine.

------------------------------------------------------------------------

## Points importants

-   Ne pas utiliser localhost côté frontend
-   Ne pas exposer PostgreSQL
-   Tester Lambda avant EventBridge
