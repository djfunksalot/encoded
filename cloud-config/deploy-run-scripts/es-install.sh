#!/bin/bash
# Setup elasticsearch data node config
# root user
# apt deps:
#   java
#   elasticsearch with apt_source and key
echo -e "\n**** ENCDINSTALL $(basename $0) ****"

CLUSTER_NAME="$1"
JVM_GIGS="$2"
ES_OPT_FILENAME="$3"
ES_IP="$4"
ES_PORT="$5"

# Install es and add to boot service
opts_src='/home/ubuntu/encoded/cloud-config/deploy-run-scripts/conf-es'
opts_dest='/etc/elasticsearch'


function copy_with_permission {
    src_file="$1"
    dest_file="$2"
    sudo -u root cp "$src_file" "$dest_file"
    sudo -u root chown root:elasticsearch "$dest_file"
}

function append_with_user {
  line="$1"
  user="$2"
  dest="$3"
  echo "$line" | sudo -u $user tee -a $dest
}


if [ "$ES_IP" == "NONE" ]; then
    # Initial ES install
    echo -e "\n\t: ENCDINSTALL $(basename $0): ES_IP is NONE"
    # jvm options
    jvm_opts_filename='jvm.options'
    jvm_xms='-Xms'"$JVM_GIGS"'g'
    jvm_xmx='-Xmx'"$JVM_GIGS"'g'
    append_with_user "$jvm_xms" ubuntu "$opts_src/$jvm_opts_filename"
    append_with_user "$jvm_xmx" ubuntu "$opts_src/$jvm_opts_filename"
    copy_with_permission "$opts_src/$jvm_opts_filename" "$opts_dest/$jvm_opts_filename"

    # elasticsearch options
    es_opts_filename="$ES_OPT_FILENAME"
    if [ "$CLUSTER_NAME" == 'NONE' ]; then
        echo 'Not a elasticsearch cluster'
    else
        # Only append a cluster name if it is not 'NONE'
        # like single demos do not have cluster names
        cluster_name="cluster.name: $CLUSTER_NAME"
        append_with_user "$cluster_name" ubuntu "$opts_src/$es_opts_filename"
    fi
    copy_with_permission "$opts_src/$es_opts_filename" "$opts_dest/elasticsearch.yml"

    # Install discovery for clusters, maybe only needed for clusters
    sudo /usr/share/elasticsearch/bin/elasticsearch-plugin install discovery-ec2
    # Add es service and start
    sudo /bin/systemctl enable elasticsearch.service
    sudo systemctl start elasticsearch.service
else
    # Post AMI Install, wait for es restart
    # Only for single demos, and frontends
    echo -e "\n\t: ENCDINSTALL $(basename $0): ES_IP is NOT NONE"
    # wait for status to be yellow or green
    watch_dog=0
    while true; do
        watch_dog=$((watch_dog + 1))
        es_status="$(curl -fsSL '$ES_IP:$ES_PORT/_cat/health?h=status')"
        echo "ES Demo Status: '$es_status'"
        if [ "$es_status" == 'yellow' ] || [ "$es_status" == 'green' ]; then
            echo 'ES Ready! Monving on.'
            break
        else
            sleep_secs=10
            echo "Waiting for es to turn yellow or green. Sleep for $sleep_secs"
            sleep $sleep_secs
        fi
        if [ $watch_dog -gt 10 ]; then
            echo -e "\n\t: ENCDINSTALL $(basename $0): ES_IP is NOT NONE.  WATCH_DOG"
            break
        fi
    done
fi
