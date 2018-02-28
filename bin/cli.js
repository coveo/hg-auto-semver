#!/usr/bin/env node
'use strict';

const execSync = require('child_process').execSync;

const Version = {
    PATCH: 'patch',
    MINOR: 'minor',
    MAJOR: 'major'
};

const VersionPosition = {
    [Version.PATCH]: 3,
    [Version.MINOR]: 2,
    [Version.MAJOR]: 1,
};

function getParentBranches() {
    const currentRev = execSync('hg id -i').toString().trim();
    const currentBranch = execSync('hg id --branch').toString().trim();
    const lastestTag = execSync(`hg log -r "." -b ${currentBranch} --template "{latesttag}"`).toString().trim();

    let branches = [];
    if (lastestTag != 'null') {
        // Get all parent branches of commits between current revision and latest tag
        branches = execSync(`hg log -r "parents(ancestor(${lastestTag}, ${currentRev})::${currentRev} - ancestor(${lastestTag}, ${currentRev}))" --template "{branch} "`).toString().trim().split(' ');
    } else {
        // Get the parent branch of the current commit
        branches = [execSync('hg log --rev "p2(.)" --template "{branch}"').toString().trim()];
    }
    // remove empty branch and duplicates
    branches = branches.filter((branch, index, arr) => branch && arr.lastIndexOf(branch) === index);
    console.log('detected branches:', branches);
    return branches;
}

function bump(type) {
    let newVersion;

    var fs = require('fs');
    if (fs.existsSync('pom.xml')) {
        const publishedVersion = JSON.stringify(execSync(`mvn -q -Dexec.executable="echo" -Dexec.args='\${project.version}' --non-recursive exec:exec`, {encoding: 'utf8'})).replace("\\n","");
        console.log('Detected current version :', publishedVersion);

        const parsedVersion = publishedVersion.match("([0-9]+){1}\.([0-9]+){1}\.([0-9]+){1}");
        if (parsedVersion.length != 4) {
            console.log('Did not match a SemVer valid version, please bump manually to a SemVer format.')
            return;
        }
        
        parsedVersion[VersionPosition[type]] =  (parseInt(parsedVersion[VersionPosition[type]], 10) + 1).toString()
        newVersion = parsedVersion[VersionPosition[Version.MAJOR]] + "." + parsedVersion[VersionPosition[Version.MINOR]] + "." + parsedVersion[VersionPosition[Version.PATCH]];
        console.log('Bumping to new version :', newVersion)

        JSON.stringify(execSync(`mvn versions:set -DnewVersion=${newVersion}`, {encoding: 'utf8'})).replace("\\n","");
    } else {
        const publishedVersions = JSON.stringify(execSync(`npm show . versions -json`, {encoding: 'utf8'}));
        do {
            newVersion = execSync(`npm version ${type}`, {encoding: 'utf8'}).trim().substr(1);
        } while(publishedVersions.indexOf(newVersion) !== -1);
    }
    return newVersion;
}

try {
    const breakingFeatureRegex = /^breaking-feature[-|\/]/igm;
    const featureRegex = /^feature[-|\/]/igm;
    const branches = getParentBranches();
    let toBump = Version.PATCH;

    // Loop on detected branches to bump according to the biggest change
    branches.forEach(branch => {
        if (breakingFeatureRegex.test(branch)) {
            toBump = Version.MAJOR;
        } else if (toBump === Version.PATCH && featureRegex.test(branch)) {
            toBump = Version.MINOR;
        }
    });

    if (toBump === Version.MAJOR) {
        console.log('Branch name contains "breaking-feature-", bumping a MAJOR version');
    } else if (toBump === Version.MINOR) {
        console.log('Branch name contains "feature-", bumping a MINOR version');
    } else {
        console.log('Branch name doesn\'t contains "breaking-feature-" or "feature-", bumping a PATCH version');
    }
    bump(toBump);
} catch (err) {
    // We don't want our CI to have an error, just log it.
    console.log(err);
}