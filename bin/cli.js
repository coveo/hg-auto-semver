#!/usr/bin/env node
'use strict';

const fs = require('fs');
const execSync = require('child_process').execSync;

const Version = {
    PATCH: 'patch',
    MINOR: 'minor',
    MAJOR: 'major',
};

const VersionPosition = {
    [Version.PATCH]: 3,
    [Version.MINOR]: 2,
    [Version.MAJOR]: 1,
};

const hasPomXML = fs.existsSync('pom.xml');

function getCurrentRevision() {
    return execSync('hg id -i').toString().trim().replace(/\+$/, '');
}

function getCurrentBranch() {
    return execSync('hg id --branch').toString().trim();
}

function getLatestTag() {
    const currentBranch = getCurrentBranch();
    const tags = execSync(`hg log -r "::." -b ${currentBranch} --template "{tags} "`).toString().trim().split(' ');

    // Remove empty tags
    const filteredTags = tags.filter((tag) => tag && tag !== 'tip');

    console.log('detected tags:', filteredTags);

    return filteredTags[filteredTags.length - 1] || null;
}

function getParentRevision() {
    const currentBranch = getCurrentBranch();
    return execSync(`hg log --rev "parents(.)" --template "{rev}" -b ${currentBranch}`).toString().trim();
}

function getParentBranches() {
    const currentRev = getCurrentRevision();
    const latestTag = getLatestTag();

    let branches = [];
    if (latestTag != null) {
        // Get all parent branches of commits between current revision and latest tag
        branches = execSync(`hg log -r "parents(ancestor(${latestTag}, ${currentRev})::${currentRev} - ancestor(${latestTag}, ${currentRev}))" --template "{branch} "`).toString().trim().split(' ');
    } else {
        // Get the parent branch of the current commit
        branches = [execSync('hg log --rev "p2(.)" --template "{branch}"').toString().trim()];
    }
    // remove empty branch and duplicates
    branches = branches.filter((branch, index, arr) => branch && arr.lastIndexOf(branch) === index);
    console.log('detected branches: ', branches);
    return branches;
}

function bump(type) {
    const latestTag = getLatestTag();
    let newVersion;

    if (hasPomXML) {
        const currentRev = getCurrentRevision();
        if (latestTag != null) {
            execSync(`hg update ${latestTag}`);
        } else {
            const parentCommit = getParentRevision();
            execSync(`hg update ${parentCommit}`);
        }
        const publishedVersion = execSync(`mvn -q -Dexec.executable="echo" -Dexec.args='\${project.version}' --non-recursive exec:exec`, {encoding: 'utf8'}).toString().trim();
        execSync(`hg update ${currentRev}`);

        console.log('Detected current version :', publishedVersion);

        const parsedVersion = publishedVersion.match("([0-9]+){1}\.([0-9]+){1}\.([0-9]+){1}");
        if (parsedVersion.length != 4) {
            console.log('Did not match a SemVer valid version, please bump manually to a SemVer format.')
            return;
        }
        
        parsedVersion[VersionPosition[type]] =  (parseInt(parsedVersion[VersionPosition[type]], 10) + 1).toString()
        if (type == Version.MAJOR) {
            parsedVersion[VersionPosition[Version.PATCH]] = 0;
            parsedVersion[VersionPosition[Version.MINOR]] = 0;
        } else if (type == Version.MINOR) {
            parsedVersion[VersionPosition[Version.PATCH]] = 0;
        }
        newVersion = parsedVersion[VersionPosition[Version.MAJOR]] + "." + parsedVersion[VersionPosition[Version.MINOR]] + "." + parsedVersion[VersionPosition[Version.PATCH]];
        console.log('Bumping to new version :', newVersion);

        execSync(`mvn versions:set -DnewVersion=${newVersion}`, {encoding: 'utf8'});
    } else {
        const publishedVersions = JSON.stringify(execSync(`npm show . versions -json`, {encoding: 'utf8'}));
        console.log(`latest tag: ${latestTag}`);
        if (latestTag != null) {
            //  Set the version to the latest tagged version
            execSync(`npm version ${latestTag} --allow-same-version`);
        }
        do {
            newVersion = execSync(`npm version ${type}`, {encoding: 'utf8'}).trim().substr(1);
        } while (publishedVersions.indexOf(newVersion) !== -1);
    }
    return newVersion;
}

try {
    const arg = process.argv.length === 3 ? process.argv[2] : '';
    let toBump = Version.PATCH;

    switch (arg) {
        case Version.PATCH:
        case Version.MINOR:
        case Version.MAJOR:
            toBump = arg;
            console.log(`Bumping a ${toBump} version as specified`);
            break;
        default:
            const breakingFeatureRegex = /^breaking-feature[-|\/]/igm;
            const featureRegex = /^feature[-|\/]/igm;
            const branches = getParentBranches();

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
    }

    bump(toBump);
} catch (err) {
    // We don't want our CI to have an error, just log it.
    console.log(err);
}
