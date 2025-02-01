#!/bin/bash -e

#####################################################################
#
# <script.sh> <file to run> <file run args>
#
# This is a script that allows us to use tsx with typechecking.
#
# Since tsx does not do typechecking this leads to weird errors so 
# we want to do our own typechecking before each run.
#
# In keeping with ts-node/tsx style use cases, we only typecheck
# the entrypoint to allow for incremental running/testing.
#
####################################################################

file=$1

if [ ! -f $file ]; then
    echo "Must provide a valid file to run!"
    echo "Provided: $file"
    exit 1
fi

tempDir="tmp-tsconfig"
if [ ! -d "$tempDir" ]; then
    mkdir $tempDir
fi
randName=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 13; echo)
configFilePath="${tempDir}/${randName}.tsconfig.json"

while [ -f "${configFilePath}" ]; do
    randName=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 13; echo)
    configFilePath="${tempDir}/${randName}.tsconfig.json"
done
touch $configFilePath

cat >$configFilePath <<EOF
// This is a temporary tsconfig.json file created by ts-run.sh to typecheck our entrypoints
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
      "noEmit": true,
      "emitDeclarationOnly": false
  },
  "include": [
EOF
echo "    \"../$file\"," >> $configFilePath
cat >>$configFilePath <<EOF
    "unused"
  ]
}
EOF
# Ensure we clean up the temp file
trap "rm -f $configFilePath" EXIT

# Perform typechecking before blind running
yarn tsc --project $configFilePath

# Perform the tsx command
yarn tsx $file ${@:2}
