========================
ENCODE Metadata Database
========================


System Installation (OSX Catlina 10.15.2)
========================================
1. Install snovault per: https://github.com/ENCODE-DCC/snovault/README.osx.catalina.rst


Application Installation (See snovault appplication install first for issues)
=========================

1. Checkout repo and install requirements
    $ git clone https://github.com/ENCODE-DCC/encoded.git

1. Create a virtual env in your work directory **Skip if using same venv as snovault**
    $ python3 -m venv .venv
    $ source .venv/bin/activate
    $ pip install -r requirements.txt

1. Build Application
    $ cd encoded
    $ make clean && buildout bootstrap && bin/buildout

1. Run Application
    $ bin/dev-servers development.ini --app-name app --clear --init --load

* In a separate terminal
    $ bin/pserve development.ini

Browse to the interface at http://localhost:8000
