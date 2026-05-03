$ErrorActionPreference = 'Continue'
.\scripts\foreman-build.ps1 -ProjectDescription 'Submission Bundle for Bob Foreman Hackathon' -TaskIds @('readme','architecture','submission','video-script')
