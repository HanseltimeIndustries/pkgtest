#!/bin/bash -e

####################################################################
# 
# <script> <version>
#
# This file calls mike and typedoc to deploy a new version of documentation.
#  
# It assumes that you are running a git client with appropriate auth
# for pushing to the protected gh-pages branch.
#
# Note: in the future, it might be easier to wirte a semantic-relase plugin
#
# args:
#   version - the full patched version
####################################################################

full_version=$1

if [ -z "$full_version" ]; then
    echo "Must supply <version> argument!"
    exit 1
fi

major_minor_optChannel=$(echo $full_version | awk -F. '{printf "%s.%s", $1, $2; if ($NF ~ /-/) {split($NF, a, "-"); printf "-%s", a[2]}}')

# Fetch the pages branch
git fetch origin gh-pages --depth=1

mike deploy $major_minor_optChannel latest --update-aliases --push
mike set-default latest