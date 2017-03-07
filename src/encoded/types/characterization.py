from snovault import (
    abstract_collection,
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item,
    SharedItem,
)
from snovault.attachment import ItemWithAttachment


@abstract_collection(
    name='characterizations',
    properties={
        'title': "Characterizations",
        'description': 'Listing of all types of characterization.',
    })
class Characterization(ItemWithAttachment, Item):
    base_types = ['Characterization'] + Item.base_types
    embedded = ['lab', 'award', 'submitted_by']


@collection(
    name='construct-characterizations',
    properties={
        'title': 'Construct characterizations',
        'description': 'Listing of biosample construct characterizations',
    })
class ConstructCharacterization(Characterization):
    item_type = 'construct_characterization'
    schema = load_schema('encoded:schemas/construct_characterization.json')

    embedded = [
        'award',
        'award.pi',
        'award.pi.lab',
        'characterizes',
        'lab',
        'documents',
        'documents.lab',
        'documents.award',
        'documents.submitted_by',
        'submitted_by',
        ]


@collection(
    name='rnai-characterizations',
    properties={
        'title': 'RNAi characterizations',
        'description': 'Listing of biosample RNAi characterizations',
    })
class RNAiCharacterization(Characterization):
    item_type = 'rnai_characterization'
    schema = load_schema('encoded:schemas/rnai_characterization.json')
    embedded = [
        'award',
        'award.pi',
        'award.pi.lab',
        'characterizes',
        'documents',
        'documents.lab',
        'documents.award',
        'documents.submitted_by',
        'lab',
        'submitted_by',
        ]


@collection(
    name='donor-characterizations',
    properties={
        'title': 'Donor characterizations',
        'description': 'Listing of model organism donor (strain) construct characterizations',
    })
class DonorCharacterization(Characterization):
    item_type = 'donor_characterization'
    schema = load_schema('encoded:schemas/donor_characterization.json')
    embedded = [
        'award',
        'award.pi',
        'award.pi.lab',
        'characterizes',
        'lab',
        'references',
        'documents',
        'documents.lab',
        'documents.award',
        'documents.submitted_by',
        'submitted_by',
        ]

@collection(
    name='biosample-characterizations',
    properties={
        'title': 'Biosample characterizations',
        'description': 'Listing of biosample characterizations',
    })
class BiosampleCharacterization(Characterization):
    item_type = 'biosample_characterization'
    schema = load_schema('encoded:schemas/biosample_characterization.json')
    embedded = [
        'award',
        'award.pi',
        'award.pi.lab',
        'characterizes',
        'documents',
        'documents.lab',
        'documents.award',
        'documents.submitted_by',
        'lab',
        'references',
        'submitted_by',
        ]


@collection(
    name='antibody-characterizations',
    properties={
        'title': 'Antibody characterizations',
        'description': 'Listing of antibody characterization documents',
    })
class AntibodyCharacterization(Characterization, SharedItem):
    item_type = 'antibody_characterization'
    schema = load_schema('encoded:schemas/antibody_characterization.json')
    embedded = [
        'submitted_by',
        'lab',
        'award',
        'award.pi',
        'award.pi.lab',
        'target',
        'target.organism',
        'documents',
        'documents.lab',
        'documents.award',
        'documents.submitted_by',
        'characterizes.targets',
        'references',
    ]

    @calculated_property(schema={
        "title": "Characterization method",
        "type": "string",
    })
    def characterization_method(self, primary_characterization_method=None,
                                secondary_characterization_method=None):
        return primary_characterization_method or secondary_characterization_method


@collection(
    name='genetic-modification-characterizations',
    properties={
        'title': 'Genetic modification characterizations',
        'description': 'Listing of genetic modifications characterizations',
    })
class GeneticModificationCharacterization(Characterization):
    item_type = 'genetic_modification_characterization'
    schema = load_schema('encoded:schemas/genetic_modification_characterization.json')
    embedded = [
        'award',
        'award.pi',
        'award.pi.lab',
        'lab',
        'characterizes',
        'documents',
        'documents.award',
        'documents.lab',
        'documents.submitted_by',
        'submitted_by',
        ]
