// CI/CD for the Event Registration stack.
// Flow: Checkout > Install > Unit Test > Build Images > throw-away test stack > Health checks > E2E
//       > Deploy (main only, build-numbered images) > Verify
// A failing stage stops the pipeline, so broken code never reaches the running site.

pipeline {
  agent any
  tools { nodejs 'node20' }

  options {
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '15'))
  }

  // Automatic trigger: Jenkins checks GitHub every ~2 minutes and builds when there is a new commit
  triggers { pollSCM('H/2 * * * *') }

  // Rollback: "Build with Parameters" and enter an old build number (e.g. 11) to redeploy that release
  parameters {
    string(name: 'ROLLBACK_TAG', defaultValue: '', description: 'Leave empty for a normal build. Or enter a previous release number to redeploy it.')
  }

  environment {
    ENV_FILE    = credentials('evt-env')     // Jenkins "Secret file" credential: the production .env (no secrets in Git)
    RELEASE     = "${params.ROLLBACK_TAG ? params.ROLLBACK_TAG : env.BUILD_NUMBER}"
    BASE_URL    = 'http://evt-ci-proxy:8080' // test copy of the app, reachable from Jenkins via ci-network
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        sh '''
          cp "$ENV_FILE" .env
          docker compose version
        '''
      }
    }

    // Everything below is skipped when this run is a rollback
    stage('Build and test') {
      when { expression { !params.ROLLBACK_TAG } }
      stages {

        stage('Install') {
          steps {
            dir('server') { sh 'npm install' }
            dir('client') { sh 'npm install' }
            dir('e2e')    { sh 'npm install' }
          }
        }

        stage('Unit Test') {
          steps {
            dir('server') { sh 'npm test' }
            dir('client') { sh 'npm test' }
          }
        }

        stage('Build Images') {
          steps {
            // "candidate" = built but not yet proven. Overwritten on every build.
            sh 'TAG=candidate docker compose build'
          }
        }

        stage('Start test stack') {
          steps {
            // Separate compose project (evtci) on its own port and its own throw-away volume
            sh '''
              docker compose -p evtci down -v --remove-orphans || true
              TAG=candidate PROXY_PORT=4001 docker compose -p evtci up -d --no-build --wait --wait-timeout 240
              # let Jenkins reach the test proxy by name through ci-network
              docker network connect --alias evt-ci-proxy ci-network $(docker compose -p evtci ps -q proxy)
            '''
          }
        }

        stage('Health checks') {
          steps {
            retry(3) {
              sh '''
                curl -fsS http://evt-ci-proxy:8080/healthz; echo
                curl -fsS http://evt-ci-proxy:8080/api/health; echo
              '''
            }
          }
        }

        stage('E2E Test') {
          steps {
            // .env gives the e2e tests the same admin login the stack was started with
            dir('e2e') { sh 'set -a; . ../.env; set +a; npm test' }
          }
        }
      }
    }

    stage('Deploy') {
      when { expression { env.GIT_BRANCH ==~ /(origin\/)?main/ } }
      steps {
        sh '''
          # one-off cleanup of containers from the old "docker run" deployment
          docker rm -f evt-web evt-server evt-db || true

          # Tests passed -> promote the tested images to a numbered release (skipped on rollback)
          if [ -z "$ROLLBACK_TAG" ]; then
            for s in db server web proxy; do docker tag evt-$s:candidate evt-$s:$RELEASE; done
          fi

          TAG=$RELEASE docker compose -p evt up -d --no-build --remove-orphans --wait --wait-timeout 240

          # Keep only the 3 newest release versions of each image
          for img in evt-db evt-server evt-web evt-proxy; do
            docker images $img --format '{{.Tag}}' | grep -E '^[0-9]+$' | sort -rn | tail -n +4 | while read t; do
              docker rmi $img:$t || true
            done
          done
        '''
      }
    }

    stage('Verify') {
      when { expression { env.GIT_BRANCH ==~ /(origin\/)?main/ } }
      steps {
        // Smoke test the live stack through the proxy, from inside the proxy container
        retry(5) {
          sleep time: 5, unit: 'SECONDS'
          sh '''
            docker compose -p evt exec -T proxy wget -qO- http://127.0.0.1:8080/healthz; echo
            docker compose -p evt exec -T proxy wget -qO- http://127.0.0.1:8080/api/health; echo
          '''
        }
      }
    }
  }

  post {
    success { echo "Release ${env.RELEASE} is live on port 4000. Roll back with: Build with Parameters > ROLLBACK_TAG = <older number>" }
    failure { echo "Build ${env.BUILD_NUMBER} failed. The previous release keeps running. Check the stage logs and ci-*.log artifacts." }
    always {
      junit allowEmptyResults: true, testResults: 'server/reports/junit.xml,client/reports/junit.xml,e2e/reports/junit.xml'
      sh '''
        docker compose -p evtci logs --no-color > ci-stack.log 2>&1 || true
        docker compose -p evtci down -v --remove-orphans || true
        docker image prune -f || true
        rm -f .env
      '''
      archiveArtifacts artifacts: 'ci-*.log', allowEmptyArchive: true
    }
  }
}
