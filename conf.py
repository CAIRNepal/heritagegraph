# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information
import os
import sys
sys.path.insert(0, os.path.abspath('../'))

project = 'heritagegraph'
copyright = '2024, CAIR-Nepal'
author = 'CAIR-Nepal'
release = '0.1'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = [
        'sphinx.ext.autodoc',
    'sphinx.ext.napoleon',  # If you want Google-style or NumPy-style docstrings
    'sphinx.ext.viewcode',  # Adds links to the source code of functions/classes
]

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']



# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_rtd_theme'
html_static_path = ['_static']

