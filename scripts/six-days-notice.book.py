#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Six Days' Notice: a print-ready storybook."""
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from PIL import Image
import os

W, H = letter
CREAM = HexColor('#F6F1E4')
INK   = HexColor('#211C15')
BAND  = HexColor('#241F19')
TAN   = HexColor('#A98F63')
GRAY  = HexColor('#6E6353')
FAINT = HexColor('#B9AD97')

MARGIN = 72
c = canvas.Canvas('/home/claude/book/Six_Days_Notice.pdf', pagesize=letter)
c.setTitle("Six Days' Notice")
c.setAuthor("A family record")
page_no = [0]

body_style = ParagraphStyle('body', fontName='Times-Roman', fontSize=11.5,
                            leading=17.5, alignment=TA_JUSTIFY, textColor=INK,
                            spaceAfter=11)
quote_style = ParagraphStyle('quote', fontName='Times-Italic', fontSize=13,
                             leading=19, alignment=TA_CENTER, textColor=INK)
attr_style = ParagraphStyle('attr', fontName='Times-Roman', fontSize=9.5,
                            leading=13, alignment=TA_CENTER, textColor=GRAY)
cap_style = ParagraphStyle('cap', fontName='Helvetica', fontSize=8,
                           leading=11.5, alignment=TA_CENTER, textColor=GRAY)
tl_year = ParagraphStyle('tly', fontName='Times-Bold', fontSize=10.5,
                         leading=14, alignment=TA_LEFT, textColor=INK)
tl_body = ParagraphStyle('tlb', fontName='Times-Roman', fontSize=10.5,
                         leading=14, alignment=TA_LEFT, textColor=INK)

def bg(color=CREAM):
    c.setFillColor(color)
    c.rect(0, 0, W, H, stroke=0, fill=1)

def folio():
    page_no[0] += 1
    if page_no[0] > 2:
        c.setFont('Times-Roman', 9)
        c.setFillColor(GRAY)
        c.drawCentredString(W/2, 40, str(page_no[0]))

def tracked(text, spacing=3):
    return ('&nbsp;'*0).join(text)  # unused helper placeholder

def draw_tracked(x, y, text, font, size, color, track=2.5, center=True):
    c.setFont(font, size)
    c.setFillColor(color)
    widths = [c.stringWidth(ch, font, size) for ch in text]
    total = sum(widths) + track*(len(text)-1)
    cx = (x - total/2) if center else x
    for ch, w0 in zip(text, widths):
        c.drawString(cx, y, ch)
        cx += w0 + track

def para(text, style, x, y_top, width):
    p = Paragraph(text, style)
    w, h = p.wrap(width, H)
    p.drawOn(c, x, y_top - h)
    return y_top - h - style.spaceAfter

# ---------------------------------------------------------------- COVER
bg(BAND)
c.setStrokeColor(TAN); c.setLineWidth(1.2)
c.rect(46, 46, W-92, H-92, stroke=1, fill=0)
c.setStrokeColor(HexColor('#4A4136')); c.setLineWidth(0.6)
c.rect(54, 54, W-108, H-108, stroke=1, fill=0)

draw_tracked(W/2, H-215, 'NIDOTO NAI YONI', 'Times-Roman', 11, TAN, track=4)
draw_tracked(W/2, H-232, 'LET IT NOT HAPPEN AGAIN', 'Times-Roman', 8.5, FAINT, track=3)

draw_tracked(W/2, H-330, "SIX DAYS' NOTICE", 'Times-Bold', 34, HexColor('#F2EBDA'), track=3.5)

c.setStrokeColor(TAN); c.setLineWidth(0.8)
c.line(W/2-90, H-362, W/2+90, H-362)

sub = ParagraphStyle('sub', fontName='Times-Italic', fontSize=14.5, leading=21,
                     alignment=TA_CENTER, textColor=HexColor('#D8CDB6'))
p = Paragraph('The Japanese Americans of Bainbridge Island,<br/>'
              'the war that took them, and the neighbors<br/>'
              'who kept their farms', sub)
w0, h0 = p.wrap(400, 200); p.drawOn(c, (W-400)/2, H-380-h0)

draw_tracked(W/2, 150, 'A STORYBOOK OF RECORD', 'Helvetica', 8.5, FAINT, track=3)
draw_tracked(W/2, 132, '1883  ·  1942  ·  1945  ·  TODAY', 'Helvetica', 8.5, TAN, track=2)
folio(); c.showPage()

# ---------------------------------------------------------------- EPIGRAPH
bg()
y = H/2 + 60
p = Paragraph('&ldquo;Let it not happen again that a group of people are singled out, '
              'that their loyalty and patriotism be questioned '
              'because of their race or ancestry.&rdquo;', quote_style)
w0, h0 = p.wrap(360, 300); p.drawOn(c, (W-360)/2, y-h0)
c.setStrokeColor(TAN); c.setLineWidth(0.7)
c.line(W/2-40, y-h0-16, W/2+40, y-h0-16)
p = Paragraph('Bainbridge Island Japanese American Exclusion Memorial', attr_style)
w0, h1 = p.wrap(360, 100); p.drawOn(c, (W-360)/2, y-h0-34)
folio(); c.showPage()

# ---------------------------------------------------------------- FOREWORD
def chapter_head(kicker, title, dates):
    draw_tracked(W/2, H-110, kicker, 'Helvetica', 8.5, TAN, track=3)
    draw_tracked(W/2, H-150, title, 'Times-Bold', 22, INK, track=2)
    if dates:
        draw_tracked(W/2, H-172, dates, 'Times-Italic', 10.5, GRAY, track=1, center=True)
    c.setStrokeColor(TAN); c.setLineWidth(0.7)
    c.line(W/2-55, H-190, W/2+55, H-190)

def text_page(kicker, title, dates, paragraphs, pull=None, pull_attr=None):
    bg()
    chapter_head(kicker, title, dates)
    y = H-225
    x = (W-440)/2
    for t in paragraphs:
        y = para(t, body_style, x, y, 440)
    if pull:
        y -= 14
        c.setStrokeColor(TAN); c.setLineWidth(0.7)
        c.line(W/2-40, y+6, W/2+40, y+6)
        y -= 12
        p = Paragraph('&ldquo;' + pull + '&rdquo;', quote_style)
        w0, h0 = p.wrap(380, 300); p.drawOn(c, (W-380)/2, y-h0); y -= h0+8
        if pull_attr:
            p = Paragraph(pull_attr, attr_style)
            w0, h0 = p.wrap(380, 100); p.drawOn(c, (W-380)/2, y-h0)
    folio(); c.showPage()

def plate_page(band_title, img, caption):
    bg()
    c.setFillColor(BAND)
    c.rect(MARGIN-8, H-96, W-2*(MARGIN-8), 34, stroke=0, fill=1)
    draw_tracked(W/2, H-84, band_title, 'Times-Roman', 12.5, HexColor('#EFE7D4'), track=3)
    im = Image.open(img)
    iw, ih = im.size
    max_w, max_h = W-2*MARGIN+20, H-96-58-118
    scale = min(max_w/iw, max_h/ih)
    dw, dh = iw*scale, ih*scale
    x0, y0 = (W-dw)/2, H-110-dh
    c.setFillColor(HexColor('#E3DAC6'))
    c.rect(x0-7, y0-7, dw+14, dh+14, stroke=0, fill=1)
    c.setStrokeColor(HexColor('#8C7B5E')); c.setLineWidth(0.8)
    c.rect(x0-7, y0-7, dw+14, dh+14, stroke=1, fill=0)
    c.drawImage(img, x0, y0, dw, dh)
    p = Paragraph(caption, cap_style)
    w0, h0 = p.wrap(430, 100); p.drawOn(c, (W-430)/2, y0-18-h0)
    folio(); c.showPage()

# Foreword
text_page('FOREWORD', 'HOW TO READ THIS BOOK', '',
[
 "This is a true story. Every date in it can be checked, and should be. "
 "The photographs of exhibit panels reproduced here were taken at a Bainbridge Island "
 "display built from the collections of the Bainbridge Island Japanese American Community "
 "and the Densho Digital Archives. The panels appear as plates between the chapters, "
 "as they appeared on the wall: creased, glassed, lit by an ordinary window.",

 "The story concerns 227 people. Farmers, mostly. Strawberry farmers, a barber, "
 "a butcher, schoolchildren with baggage tags tied to their coats. On March 30, 1942, "
 "the United States Army removed them from their island because of their ancestry. "
 "They were the first in the nation. More than 120,000 people followed them into the camps, "
 "two thirds of them American citizens. No court ever convicted one of them of espionage. "
 "Not one.",

 "Bainbridge Island is worth telling about for a second reason. When the government "
 "failed its own citizens, some neighbors did not. A newspaper kept its word. Farmhands "
 "kept the strawberries alive. And in April of 1945, when the ferry brought the first "
 "families home, people were standing at the dock.",
],
pull="It's like they were waiting for us.",
pull_attr='Lilly Kodama, removed from Bainbridge Island at age seven')

# CHAPTER I
text_page('CHAPTER ONE', 'YAMA', 'The village on the hill, 1883 to 1922',
[
 "Begin with lumber. In the 1870s the Port Blakely Mill on the south end of Bainbridge "
 "Island was cutting more timber than almost any yard on earth, and it needed hands. "
 "They came from everywhere. Among them, beginning in the early 1880s, came young men "
 "from Japan.",

 "Above the mill they built a settlement and called it Yama, the Japanese word for "
 "mountain. Nearly 300 people lived there at its height. Yama had a hotel, restaurants, "
 "a tofu shop, bathhouses, barbershops, a bakery, and about fifty homes. A horse drawn "
 "wagon delivered groceries from the general store at Yama and at Port Blakely. "
 "Children were born there. Children were buried there.",

 "The mill closed in 1920 and Yama emptied. The families did not leave the island. "
 "They cleared stumps and planted strawberries, opened stores, cut meat at the Eagle "
 "Harbor Market. Their berries went to Seattle by the ton. Their sons and daughters "
 "went to Bainbridge High School. By December of 1941 the Japanese community had been "
 "on the island for nearly sixty years. They were not newcomers. They were neighbors.",
])
plate_page('BUILDING A COMMUNITY', 'img/p400.jpg',
 'Exhibit panel: sawmill workers at Port Blakely, the Yama general store, a strawberry '
 'field, a family picnic in the 1930s, and a butcher at the Eagle Harbor Meat Market, 1942. '
 'Historic photographs courtesy of BIJAC.')

# CHAPTER II
text_page('CHAPTER TWO', 'WAR', 'December 7, 1941 to February 19, 1942',
[
 "Japan bombed Pearl Harbor on Sunday morning, December 7, 1941. Bainbridge Island sat "
 "in the middle of a war map: the Bremerton Naval Shipyard to the west, the Sand Point "
 "Naval Air Station and a torpedo station across the water, Seattle eight miles by ferry. "
 "Suspicion arrived before any order did.",

 "Island families read the papers and understood. They burned kimonos in burn barrels. "
 "Painted scrolls, letters from grandparents, heirlooms carried across the Pacific went "
 "into outhouses and stoves, destroyed by their owners so that no agent could call them "
 "evidence. In early February the FBI came anyway. Agents confiscated radios, guns, "
 "binoculars, and the dynamite the farmers used for clearing stumps. They arrested 34 "
 "island men without charges. Eleven were shipped to Department of Justice camps out of "
 "state. Their families learned where they were by letter, later.",

 "On February 19, 1942, President Franklin D. Roosevelt signed Executive Order 9066. "
 "It named no ancestry. It did not have to. It gave the Army power to declare military "
 "zones and remove anyone from them. Lieutenant General John L. DeWitt of the Western "
 "Defense Command chose to begin with one small island in Puget Sound.",
],
pull='Oh, we were very, very nervous, because hey, we have the face of the enemy.',
pull_attr='Gerald "Jerry" Nakata, Bainbridge Island')
plate_page('WAR', 'img/p401.jpg',
 'Exhibit panel: anti-Japanese graffiti, a Seattle Police property receipt, the Bainbridge '
 'Island Review headline on FBI seizures of February 1942, and President Roosevelt at his desk. '
 'Courtesy of BIJAC and Densho Digital Archives.')

# CHAPTER III
text_page('CHAPTER THREE', 'THE ORDER', 'March 24, 1942',
[
 "It went up on telephone poles and store windows on March 24, 1942: Civilian Exclusion "
 "Order No. 1, the first in the United States. INSTRUCTIONS TO ALL JAPANESE LIVING ON "
 "BAINBRIDGE ISLAND. All persons of Japanese ancestry, citizen and alien alike, would be "
 "gone by noon on Monday, March 30. Six days.",

 "Read the poster closely. It is courteous. The Civil Control Office near the ferry "
 "landing at the Anderson Dock Store in Winslow stood ready to give advice, arrange "
 "medical examinations, and assist with the management, leasing, sale, storage or other "
 "disposition of most kinds of property: farms, livestock, boats, tools, household goods, "
 "automobiles. The government offered every service except the one that mattered, which "
 "was to let them stay.",

 "Six days to decide the fate of a farm that took twenty years to clear. Six days to "
 "find someone to trust with a house, a truck, a dog. Families could bring only what "
 "they could carry or wear. Everything else was sold for pennies, stored on faith, "
 "or left. The berry crop was in the ground and June was coming. Someone else would "
 "pick it, or no one would.",
])
plate_page('CIVILIAN EXCLUSION ORDER NO. 1', 'img/p391.jpg',
 'The Army poster of March 24, 1942, issued by the Western Defense Command and Wartime '
 'Civil Control Administration: all Japanese persons, "both alien and non-alien," to be '
 'removed from Bainbridge Island by noon, March 30, 1942.')

# CHAPTER IV
text_page('CHAPTER FOUR', 'THE JOURNEY', 'March 30, 1942',
[
 "On the morning of March 30, 1942, Army trucks rolled down the island roads and "
 "collected 227 men, women, and children, two thirds of them American citizens. "
 "Soldiers carried rifles with fixed bayonets. Some of the same soldiers carried "
 "luggage, and babies, and some of them wept while they did it. The families walked "
 "down Taylor Avenue to the Eagledale ferry dock and boarded the Kehloken for Seattle. "
 "Classmates from Bainbridge High stood on the hillside and cried.",

 "A Seattle news photographer caught Fumiko Hayashida on the dock, holding her sleeping "
 "thirteen month old daughter, a baggage tag hanging from her coat like freight. The "
 "picture went around the world. She had not been told where she was going. Neither "
 "had anyone else.",

 "Pets were forbidden. The Moji family left their dog King with a willing neighbor. "
 "After they were taken, King refused to eat, and starved. From Seattle a train with "
 "blacked out windows carried the islanders 1,000 miles south to the Owens Valley of "
 "California, to a half built camp in the desert called Manzanar. They were its first "
 "prisoners.",
],
pull="You're taking away some of our best friends.",
pull_attr='Earl Hanson, Bainbridge Island, to the soldiers, March 30, 1942')
plate_page('JOURNEY', 'img/p392.jpg',
 'Exhibit panel: exclusion notices handed out on Bainbridge Island, Army trucks on '
 'evacuation day, families at the Eagledale dock, and a mother carrying her children '
 'to the ferry, March 30, 1942. Courtesy of BIJAC and Densho Digital Archives.')
plate_page('LILLY KODAMA AND FAMILY', 'img/p397.jpg',
 'Seven year old Lilly Kodama and her family at the dock on March 30, 1942, children '
 'wearing government baggage tags; and Lilly Kodama seventy five years later at the '
 'memorial wall, still telling the story.')

# CHAPTER V
text_page('CHAPTER FIVE', 'MANZANAR', 'April 1942 to February 1943',
[
 "The train stopped at Lone Pine, California, on April 1, 1942, beneath the Sierra "
 "Nevada. Manzanar was not finished. The islanders watched carpenters nail tar paper "
 "to pine boards that would be their walls. A barrack room held a stove, a hanging "
 "light bulb, army cots, two blankets each, and a mattress cover to be stuffed with "
 "straw by hand. Sand blew up through the gaps in the floor. Ten thousand people "
 "would eventually live inside the wire.",

 "Nearly all the other inmates were city people from Los Angeles. The farm families "
 "from Puget Sound, used to rain and cedar, found themselves out of place in an "
 "alkaline desert among strangers. Meals came in mess halls, a thousand at a sitting. "
 "Toilets stood in open rows without partitions. Fathers who had run farms now stood "
 "in line for everything. Family authority, built over decades, wore away in months.",

 "The Bainbridge Islanders petitioned the government for a transfer north, to the camp "
 "in Idaho where the rest of western Washington's Japanese Americans were held. After "
 "nearly a year, the government agreed. In February 1943 they packed again, this time "
 "for a place called Minidoka.",
],
pull='But in camp, when you got in camp, it was like another world.',
pull_attr='Tats Kojima, Bainbridge Island')
plate_page('MANZANAR', 'img/p402.jpg',
 'Exhibit panel: the ten War Relocation Authority camps; barracks beneath the Sierra '
 'Nevada; the cemetery monument at Manzanar; and three boys at the fence line. The '
 'panel asks which name is honest: relocation camp, internment camp, concentration camp.')

# CHAPTER VI
text_page('CHAPTER SIX', 'MINIDOKA', 'February 1943 to 1945',
[
 "Minidoka sat on sagebrush flats near Hunt, Idaho. Summer meant dust. Winter meant "
 "mud to the ankle, and the islanders cut their own wooden sandals to get across it. "
 "The barracks were the same barracks: four families to a building, one room to a "
 "family, no privacy anywhere. But at Minidoka the Bainbridge people were among "
 "Washington and Oregon neighbors, and that counted for something. They were the last "
 "group to fill a block in one of the last camps completed.",

 "The islanders kept their community alive by hand. Paul Ohtaki, a Bainbridge High "
 "graduate who had set type for the island paper before the war, wrote dispatches from "
 "camp so that folks back home could follow their neighbors: weddings, graduations, "
 "births, a column headed Find Friends at Minidoka. Young men left the camp in Army "
 "uniform for the 442nd Regimental Combat Team, which fought in Italy and France and "
 "became one of the most decorated units in American history. They enlisted from "
 "behind barbed wire. Their parents remained behind it.",

 "Three years passed this way. Straw mattresses, mess hall bells, a flag on a pole "
 "over the barracks, school photographs against tar paper. The children grew. The "
 "island got farther away, and closer.",
])
plate_page('LIFE IN CAMP', 'img/p393.jpg',
 'Exhibit panel: the flag over Manzanar, handmade geta sandals for the mud, a muddy '
 'lane at Minidoka in 1942, children on the boardwalk, and the mess hall. Courtesy of '
 'BIJAC and Densho Digital Archives.')
plate_page('THE CAMPS · MINIDOKA', 'img/p403.jpg',
 'Exhibit panel: the exclusion zone and camp map of the western United States, the '
 'Minidoka National Historic Site in Idaho, and the children of Minidoka posing '
 'outside their barracks in the 1940s.')

# CHAPTER VII
text_page('CHAPTER SEVEN', 'MEANWHILE, ON BAINBRIDGE', 'The ones who spoke',
[
 "In 1940 a young couple named Walt and Milly Woodward bought the weekly Bainbridge "
 "Review. Two months before Pearl Harbor they pledged on the front page to speak the "
 "truth, unafraid. The day after the attack, while coastal papers printed hate, the "
 "Review warned its readers against blind hatred of their Japanese American neighbors. "
 "It kept warning them, in print, every week, through the whole war. Among West Coast "
 "newspapers this made the Review nearly alone.",

 "The Woodwards did something more practical than editorials. They hired the removed "
 "islanders as correspondents. Paul Ohtaki and others filed camp news from Manzanar "
 "and Minidoka, and the Review printed it beside the school lunch menus and the ferry "
 "schedule, so that the exiles stayed what they had always been: islanders, neighbors, "
 "names.",

 "Not everyone agreed. A man named Lambert Schuyler founded the Live and Let Live "
 "Legion to preach that the Japanese should never return. Most islanders declined to "
 "join. The Legion disbanded. Meanwhile Filipino farmhands and white neighbors worked "
 "the strawberry fields of absent families, paid the taxes on some of the farms, and "
 "kept the equipment oiled. None of this was required of them. That is the point.",
],
pull='Bainbridge is a very exceptional place. There were people here willing to stick out '
     'their necks for us even before we left and while we were gone.',
pull_attr='Frank Kitamoto, Bainbridge Island')
plate_page('MEANWHILE, ON BAINBRIDGE', 'img/p394.jpg',
 'Exhibit panel: Paul Ohtaki at his typewriter; his Bainbridge Review dispatch "Find '
 'Friends at Minidoka"; and the record of the Woodwards, who pledged to speak the '
 'truth, unafraid. Courtesy of BIJAC and Densho Digital Archives.')

# CHAPTER VIII
text_page('CHAPTER EIGHT', 'THE SIGNS', 'What waited elsewhere',
[
 "To measure Bainbridge, look off the island. In Kent, Washington, on March 2, 1944, "
 "a barber named G. S. Hanft posed for a photographer, grinning, pointing at the sign "
 "over his register telling Japanese customers they were unwelcome forever. In Seattle "
 "a woman stood on her porch under a banner declaring the block a white man's "
 "neighborhood and told the Japanese to keep moving. The Hearst papers ran the ouster "
 "of the Japanese as a running front page victory.",

 "When the Nagaishi family returned to Seattle in 1945, they found their garage doors "
 "painted with graffiti telling them to leave. Anti-Japanese leagues met in halls up "
 "and down the coast to keep the returning families out. Newspapers printed the "
 "meeting notices. This was the ordinary weather of the West Coast in 1945.",

 "The same ferry route, eight miles west, led to a different country. No committee "
 "on Bainbridge succeeded in organizing against the return. The island's shame is "
 "real and shared with the nation: its people watched 227 neighbors marched to a "
 "dock and did not stop it. Its honor is particular: when those neighbors came back, "
 "the island acted like their home. Both things are true. Keep both.",
])
plate_page('RACISM', 'img/p399.jpg',
 'Exhibit panel: a Kent, Washington barber and his sign, March 2, 1944; Hearst '
 'newspaper racks photographed by Dorothea Lange in Oakland, 1942; graffiti on the '
 'Nagaishi family garage, Seattle, 1945; and a Seattle porch banner.')

# CHAPTER IX
text_page('CHAPTER NINE', 'HOMECOMING', 'April 1945',
[
 "The exclusion orders fell at the start of 1945, and in April the first Bainbridge "
 "families came home from Minidoka after three years of imprisonment. The men came "
 "first, alone, to read the island's mood and find out whether it was safe to bring "
 "their wives and children. What they found were neighbors at the dock.",

 "Homecoming was not simple. Some families returned to farms gone to weeds and were "
 "forced to sell. Getting fields back into production took seasons. But islanders "
 "showed up with what they had: legal advice, borrowed trucks, hands for weeding. "
 "The Woodwards' paper had kept the exiles' names in local print for three years, "
 "and it is hard to hate a name you have been reading beside the ferry schedule.",

 "Of the island's Japanese American community, roughly 150 came home, more than half, "
 "a higher share than almost any community on the West Coast, where many families "
 "never went back at all. The Kitamotos returned. The Kodamas returned. The "
 "strawberries came back into bearing. In most places the story ends with scattering. "
 "On Bainbridge it ends with a dock, and people standing on it.",
],
pull="It's like they were waiting for us.",
pull_attr='Lilly Kodama, on returning to Bainbridge Island, 1945')
plate_page('HOMECOMING', 'img/p395.jpg',
 'Exhibit panel: the Hayashida family photographed at the Minidoka gate before the '
 'trip home, 1945, and a Seattle storefront painted with anti-Japanese graffiti, '
 'November 1944, the welcome that awaited returnees off the island.')

# CHAPTER X
text_page('CHAPTER TEN', 'THE MEMORIAL', '1998 to today',
[
 "For decades the story was carried privately, the way hard stories are. In 1998 the "
 "Bainbridge Island Japanese American Community resolved to build a memorial at the "
 "place where it happened: the old Eagledale ferry landing at Eagle Harbor, the exact "
 "ground the 227 crossed on March 30, 1942.",

 "Architect Johnpaul Jones, an island resident, designed a story wall of old growth "
 "red cedar, granite, and basalt, 276 feet long, one foot for each of the island's "
 "276 Japanese American residents of 1942, each name and age carved into it. Friezes "
 "along the wall tell the story in five movements: immigration, inclusion, exclusion, "
 "incarceration, return. In 2008 Congress attached the site to the Minidoka National "
 "Historic Site, binding the island to the Idaho desert in law as it was bound in "
 "memory. The wall was dedicated in 2011, with survivors of the ferry present.",

 "Over the entrance stand three Japanese words: Nidoto Nai Yoni. Let it not happen "
 "again. Not a plea. An instruction, left by the people it happened to, addressed "
 "to everyone who walks down that path to the water.",
],
pull='As you approach it, does it create in you a different sense of being?',
pull_attr='Sada Omoto, on what the memorial should do')
plate_page('THE MEMORIAL', 'img/p396.jpg',
 'Exhibit panel: the memorial wall with family names; Shigeko Kitamoto holding the '
 '1942 photograph of herself and her children on evacuation day; the Hayashida family '
 'on their last day at Minidoka; and the interpretive center design at Eagle Harbor.')

# ---------------------------------------------------------------- TIMELINE
bg()
chapter_head('THE RECORD', 'TIMELINE', '')
events = [
 ('1883', 'Japanese immigrants begin work at the Port Blakely Mill; the village of Yama grows above it, home to nearly 300.'),
 ('1920', 'The mill closes. Families stay, turning to strawberry farming, stores, and trades across the island.'),
 ('Dec. 7, 1941', 'Japan attacks Pearl Harbor. Island families burn heirlooms rather than have them called evidence.'),
 ('Feb. 1942', 'FBI agents seize radios, guns, and stump dynamite; 34 island men are arrested without charge.'),
 ('Feb. 19, 1942', 'President Roosevelt signs Executive Order 9066, authorizing military exclusion zones.'),
 ('Mar. 24, 1942', 'Civilian Exclusion Order No. 1 is posted on Bainbridge Island, the first in the nation. Six days\' notice.'),
 ('Mar. 30, 1942', '227 islanders, two thirds of them citizens, board the ferry Kehloken at Eagledale under armed guard.'),
 ('Apr. 1, 1942', 'The islanders become the first prisoners at Manzanar, California, still under construction.'),
 ('Feb. 1943', 'At their own petition, the Bainbridge families transfer to Minidoka, Idaho, among Northwest neighbors.'),
 ('1943 to 1945', 'Island sons serve in the 442nd Regimental Combat Team, among the most decorated units in U.S. history.'),
 ('Jan. 1945', 'The exclusion orders end. In April the first Bainbridge families return; neighbors meet them at the dock.'),
 ('1988', 'The Civil Liberties Act: a formal apology and $20,000 in redress to each surviving internee.'),
 ('2008', 'Congress makes the Eagledale site part of the Minidoka National Historic Site.'),
 ('2011', 'The 276 foot memorial story wall is dedicated at Eagle Harbor, bearing all 276 names.'),
]
y = H-225
for yr, ev in events:
    p1 = Paragraph(yr, tl_year); w1, h1 = p1.wrap(88, 100)
    p2 = Paragraph(ev, tl_body); w2, h2 = p2.wrap(342, 200)
    hh = max(h1, h2)
    p1.drawOn(c, 82, y-h1)
    c.setFillColor(TAN); c.circle(182, y-5, 1.6, stroke=0, fill=1)
    p2.drawOn(c, 194, y-h2)
    y -= hh + 9
folio(); c.showPage()

# ---------------------------------------------------------------- AFTERWORD
text_page('AFTERWORD', 'THE LEDGER', '',
[
 "Count it up. More than 120,000 people of Japanese ancestry removed from the West "
 "Coast. Two thirds American citizens. Convictions for espionage or sabotage among "
 "them: zero. In 1983 a federal commission reviewed the record and named the causes "
 "in eight words: race prejudice, war hysteria, and a failure of political leadership. "
 "In 1988 Congress passed and President Reagan signed the Civil Liberties Act, an "
 "apology on behalf of the nation and $20,000 to each surviving internee. Money for "
 "farms, businesses, educations, and years that money does not buy back. The ledger "
 "does not balance. Honest ledgers sometimes cannot.",

 "The Constitution did not fail in 1942. The people charged with keeping it failed, "
 "which is a different thing, because it means the failure was a choice, and the "
 "keeping is also a choice, every time. An executive order, a general, a poster on a "
 "telephone pole: that was the whole machinery. It ran because almost no one stood "
 "in front of it.",

 "Almost. A newspaper couple who promised to speak the truth, unafraid, and did. "
 "Farmhands who kept other men's fields alive for three unpaid years. Soldiers who "
 "cried while obeying. Islanders standing on a dock in April of 1945, waiting. "
 "None of them could stop the ferry from leaving. They could decide what the island "
 "would be when it came back. That decision is the inheritance. Nidoto Nai Yoni.",
])

# ---------------------------------------------------------------- SOURCES
bg()
chapter_head('CREDITS', 'SOURCES &amp; NOTES'.replace('&amp;','&'), '')
src_style = ParagraphStyle('src', fontName='Times-Roman', fontSize=10.5,
                           leading=15.5, alignment=TA_LEFT, textColor=INK,
                           spaceAfter=9)
y = H-225
x = (W-440)/2
for t in [
 '<b>Plates.</b> The exhibit panels reproduced in this book were photographed on '
 'Bainbridge Island. The historic photographs within them are credited on the panels '
 'to the Bainbridge Island Japanese American Community (BIJAC) and the Densho Digital '
 'Archives, with individual images by Dorothea Lange and Seattle press photographers. '
 'This book is a personal keepsake, made for family remembrance and education.',

 '<b>Principal sources.</b> Bainbridge Island Japanese American Community (bijac.org); '
 'the Bainbridge Island Japanese American Exclusion Memorial (bijaema.org); the National '
 'Park Service, Minidoka National Historic Site; Densho Digital Archives (densho.org); '
 'the Commission on Wartime Relocation and Internment of Civilians, <i>Personal Justice '
 'Denied</i> (1983); the Civil Liberties Act of 1988; and Milly and Walt Woodward\'s '
 '<i>Bainbridge Review</i>, 1941 to 1945.',

 '<b>Quotations.</b> Spoken recollections of Gerald Nakata, Tats Kojima, Lilly Kodama, '
 'Frank Kitamoto, Earl Hanson, and Sada Omoto are reproduced from the exhibit panels, '
 'several as collected in <i>In Defense of Our Neighbors</i>, the history of the '
 'Woodwards and the Review.',

 '<b>A note on numbers.</b> 227 people were removed from the island on March 30, 1942. '
 'The memorial wall carries 276 names: every Japanese American resident of Bainbridge '
 'Island in 1942, including those already arrested, already serving, or forced to move '
 'before the ferry sailed. Both numbers are correct. Both are on the wall.',

 '<b>To visit.</b> Bainbridge Island Japanese American Exclusion Memorial, '
 '4192 Eagle Harbor Drive NE, Bainbridge Island, Washington. The path runs downhill '
 'to the water, the way they walked.',
]:
    y = para(t, src_style, x, y, 440)

c.setStrokeColor(TAN); c.setLineWidth(0.7)
c.line(W/2-40, 118, W/2+40, 118)
draw_tracked(W/2, 98, 'NIDOTO NAI YONI', 'Times-Roman', 10, TAN, track=3.5)
folio(); c.showPage()

c.save()
print('pages:', page_no[0])
EOF_MARKER = True
