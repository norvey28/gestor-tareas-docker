// Pipeline de integracion continua del gestor de tareas.
// Jenkins lo lee desde el repositorio (Pipeline script from SCM).
pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    // Revisa GitHub cada 5 minutos y ejecuta el pipeline si hay commits nuevos.
    triggers {
        pollSCM('H/5 * * * *')
    }

    environment {
        IMAGEN      = 'tareas-app'
        RED         = 'tareas-net'
        CONT_DB     = 'tareas-db'
        CONT_APP    = 'tareas-app'
        DB_NAME     = 'tareasdb'
        // Credencial tipo "Secret text" creada en Jenkins con el ID mysql-password
        DB_PASSWORD = credentials('mysql-password')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --pretty=format:"Commit %h - %s (%an)"'
            }
        }

        stage('Verificar herramientas') {
            steps {
                sh 'docker version --format "Cliente Docker {{.Client.Version}} / Servidor Docker {{.Server.Version}}"'
            }
        }

        stage('Pruebas') {
            steps {
                sh 'docker build --target test -t ${IMAGEN}:test ./app'
                sh 'mkdir -p reportes'
                sh 'docker run --rm ${IMAGEN}:test node --test --test-reporter=junit > reportes/junit.xml'
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'reportes/junit.xml'
                }
            }
        }

        stage('Construir imagen') {
            steps {
                sh 'docker build --target produccion -t ${IMAGEN}:${BUILD_NUMBER} -t ${IMAGEN}:latest ./app'
                sh 'docker images ${IMAGEN}'
            }
        }

        stage('Desplegar') {
            steps {
                sh '''
                    docker network inspect $RED > /dev/null 2>&1 || docker network create $RED

                    if [ -z "$(docker ps -aq -f name=^${CONT_DB}$)" ]; then
                        echo "Creando el contenedor de base de datos $CONT_DB"
                        docker run -d --name $CONT_DB --network $RED \
                            -e MYSQL_ROOT_PASSWORD="$DB_PASSWORD" -e MYSQL_DATABASE=$DB_NAME mysql:8.4
                    else
                        echo "El contenedor $CONT_DB ya existe; se asegura que este encendido"
                        docker start $CONT_DB > /dev/null
                    fi

                    docker rm -f $CONT_APP > /dev/null 2>&1 || true
                    docker run -d --name $CONT_APP --network $RED -p 3000:3000 \
                        -e DB_HOST=$CONT_DB -e DB_PASSWORD="$DB_PASSWORD" -e DB_NAME=$DB_NAME \
                        ${IMAGEN}:${BUILD_NUMBER}
                '''
            }
        }

        stage('Verificar despliegue') {
            steps {
                sh '''
                    for i in $(seq 1 30); do
                        if docker exec $CONT_APP wget -qO- http://localhost:3000/api/health 2>/dev/null | grep -q '"baseDeDatos":"conectada"'; then
                            echo "Despliegue verificado: tareas-app se comunica con tareas-db"
                            docker exec $CONT_APP wget -qO- http://localhost:3000/api/health
                            echo
                            docker ps --filter name=tareas-
                            exit 0
                        fi
                        echo "Esperando a que la aplicacion se conecte a MySQL ($i/30)..."
                        sleep 5
                    done
                    docker logs $CONT_APP
                    exit 1
                '''
            }
        }
    }

    post {
        success {
            echo "Build ${env.BUILD_NUMBER} exitoso: aplicacion disponible en http://localhost:3000"
        }
        failure {
            echo "Build ${env.BUILD_NUMBER} fallido: revisar la etapa marcada en rojo"
        }
    }
}
