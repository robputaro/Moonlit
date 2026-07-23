import { jsPDF } from 'jspdf';
import { ACTIVITY_LIBRARY_VERSION, buildAdventurePlan, getAdventureTheme, getAgeBand } from './adventure-activities';

const W = 8.5;
const H = 11;

function safe(value, fallback = '') {
  return String(value || fallback).replace(/[^a-zA-Z0-9 '\-]/g, '').slice(0, 60);
}

function title(pdf, text, instruction, page, childName) {
  pdf.setTextColor(40, 38, 55);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  pdf.text(text, 0.65, 0.7);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(90, 86, 105);
  pdf.text(instruction, 0.65, 0.95, { maxWidth: 7.15 });
  pdf.setDrawColor(218, 212, 225);
  pdf.line(0.65, 1.12, 7.85, 1.12);
  pdf.setFontSize(7.5);
  pdf.text(`${childName}'s AMI Adventure Book`, 0.65, 10.65);
  pdf.text(String(page), 7.85, 10.65, { align: 'right' });
}

function motif(pdf, motif, x, y, scale = 1, filled = false) {
  pdf.setLineWidth(0.03 * scale);
  if (motif === 'space') {
    pdf.circle(x, y, 0.28 * scale, filled ? 'FD' : 'S');
    pdf.ellipse(x, y, 0.48 * scale, 0.14 * scale, 'S');
    pdf.circle(x - 0.1 * scale, y - 0.06 * scale, 0.035 * scale, 'S');
    return;
  }
  if (motif === 'magic') {
    const r = 0.3 * scale;
    const points = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 ? r * 0.42 : r;
      points.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
    }
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      pdf.line(x1, y1, x2, y2);
    }
    return;
  }
  pdf.ellipse(x, y, 0.38 * scale, 0.22 * scale, filled ? 'FD' : 'S');
  pdf.circle(x + 0.32 * scale, y - 0.12 * scale, 0.16 * scale, filled ? 'FD' : 'S');
  pdf.line(x - 0.2 * scale, y + 0.16 * scale, x - 0.22 * scale, y + 0.42 * scale);
  pdf.line(x + 0.05 * scale, y + 0.18 * scale, x + 0.08 * scale, y + 0.42 * scale);
  pdf.line(x - 0.38 * scale, y - 0.04 * scale, x - 0.54 * scale, y - 0.18 * scale);
}

function choiceCircle(pdf, x, y, label) {
  pdf.circle(x, y, 0.22, 'S');
  pdf.setFontSize(10);
  pdf.text(label, x + 0.34, y + 0.04);
}

function dottedLine(pdf, x1, y1, x2, y2) {
  pdf.setLineDashPattern([0.08, 0.08], 0);
  pdf.line(x1, y1, x2, y2);
  pdf.setLineDashPattern([], 0);
}

function renderInterior(pdf, activity, context) {
  const { childName, band, theme } = context;
  const p = activity.pageNumber;
  pdf.setTextColor(35, 33, 45);
  pdf.setDrawColor(55, 53, 65);
  pdf.setFillColor(255, 255, 255);

  const headings = {
    bookplate: ['This book belongs to…', `Write or trace ${childName}'s name, then decorate the frame.`],
    'hero-coloring': [`${childName}'s big adventure`, 'Color the scene and add anything the adventure needs.'],
    'trace-path': [band.id === '8-10' ? 'Choose the smartest path' : 'Follow the adventure trail', band.id === '2-3' ? 'Trace the big dotted path with a crayon.' : 'Trace the path without touching the sides.'],
    matching: ['Match the adventure pairs', band.id === '2-3' ? 'Draw a line between the shapes that are the same.' : 'Connect each symbol on the left to its matching partner.'],
    counting: ['Count the discoveries', `Count each group and circle the correct number.`],
    maze: [`Help ${childName} find the way`, 'Start at the star and follow the open path to the treasure.'],
    'spot-difference': [activity.variant === 'big-small' ? 'Big or small?' : 'Spot what changed', activity.variant === 'big-small' ? 'Circle the biggest picture in each row.' : 'Find and circle the five differences.'],
    pattern: ['Finish the pattern', 'Draw the symbol that comes next in each row.'],
    'connect-dots': ['Connect the dots', 'Connect the numbers in order, then color the picture.'],
    'draw-world': [`Draw ${childName}'s next discovery`, 'Use the whole page. There is no wrong way to imagine it.'],
    'hidden-objects': [`Search ${childName}'s ${theme.shortName.toLowerCase()} world`, 'Find and circle all six tiny stars hidden in the scene.'],
    'name-tracing': [activity.variant === 'creative-title' ? 'Invent an adventure title' : `Practice ${childName}'s name`, activity.variant === 'creative-title' ? 'Give this adventure a title and decorate every letter.' : 'Trace the dotted letters, then try writing the name alone.'],
    'story-choice': [activity.variant === 'comic-prompt' ? 'Create a three-panel comic' : `What should ${childName} do next?`, activity.variant === 'comic-prompt' ? 'Draw what happens first, next, and last.' : 'Circle a choice, then draw what happens.'],
    sequence: ['What comes first?', 'Number the pictures 1, 2, and 3 to put them in order.'],
    design: [`Design something for ${childName}`, `Create a brand-new ${theme.motif === 'space' ? 'rocket' : theme.motif === 'magic' ? 'crown' : 'dinosaur egg'}. Add colors, patterns, and a name.`],
    'odd-one': ['Find the one that is different', 'Circle the picture that does not match in each row.'],
    'word-code': [activity.variant === 'favorite-color' ? 'Choose your favorites' : 'Crack the adventure code', activity.variant === 'favorite-color' ? 'Circle a favorite in every row.' : 'Use the symbol key to decode the secret word.'],
    certificate: ['Official AMI Explorer', `This certifies that ${childName} completed a very big adventure.`],
    'next-adventure': ['The adventure can keep going', `Save this page for ${childName}'s next big idea.`]
  };
  const [heading, instruction] = headings[activity.type] || ['Adventure activity', 'Have fun and make it your own.'];
  title(pdf, heading, instruction, p, childName);

  if (activity.type === 'bookplate') {
    pdf.roundedRect(1.1, 2.0, 6.3, 6.8, 0.18, 0.18, 'S');
    for (let i = 0; i < 8; i += 1) motif(pdf, theme.motif, 1.35 + (i % 4) * 1.9, 2.35 + Math.floor(i / 4) * 5.9, 0.65);
    pdf.setFontSize(32); pdf.setTextColor(...theme.accent); pdf.text(childName, 4.25, 5.25, { align: 'center' });
    dottedLine(pdf, 1.8, 5.55, 6.7, 5.55);
    pdf.setFontSize(11); pdf.setTextColor(80); pdf.text('Created with AMI', 4.25, 8.2, { align: 'center' });
  } else if (activity.type === 'hero-coloring') {
    motif(pdf, theme.motif, 4.25, 5.0, 4.1);
    pdf.setFontSize(12); pdf.text(`Add ${childName} to the picture!`, 4.25, 8.3, { align: 'center' });
  } else if (activity.type === 'trace-path') {
    const points = [[1.0,2.2],[2.3,2.8],[1.5,4.1],[3.5,4.8],[5.5,3.3],[7.2,4.8],[5.8,6.1],[3.4,6.8],[6.9,8.4]];
    pdf.setLineWidth(0.12); pdf.setLineDashPattern([0.12,0.1],0);
    for (let i=0;i<points.length-1;i+=1) pdf.line(...points[i],...points[i+1]);
    pdf.setLineDashPattern([],0); motif(pdf, theme.motif, 7.1, 8.4, 1.1);
  } else if (activity.type === 'matching') {
    for (let i=0;i<4;i+=1) { motif(pdf, theme.motif, 1.5,2.3+i*1.75,0.65+i*.08); motif(pdf,theme.motif,7.0,2.3+((i*3)%4)*1.75,0.65+i*.08); }
  } else if (activity.type === 'counting') {
    const amounts = band.id === '2-3' ? [1,2,3] : band.id === '4-5' ? [3,5,7] : [6,8,10];
    amounts.forEach((amount,row)=>{ for(let i=0;i<amount;i+=1) motif(pdf,theme.motif,1.15+(i%5)*.65,2.25+row*2.35+Math.floor(i/5)*.65,.42); [amount-1,amount,amount+1].forEach((n,j)=>choiceCircle(pdf,5.1+j*.9,2.5+row*2.35,String(n))); });
  } else if (activity.type === 'maze') {
    const rows=9, cols=7, left=1.15, top=1.7, cell=.78;
    pdf.setLineWidth(.035);
    for(let r=0;r<=rows;r+=1) for(let c=0;c<cols;c+=1) if(!(c===Math.min(cols-1,Math.floor(r/2))&&r<rows)) pdf.line(left+c*cell,top+r*cell,left+(c+1)*cell,top+r*cell);
    for(let c=0;c<=cols;c+=1) pdf.line(left+c*cell,top,left+c*cell,top+rows*cell);
    pdf.setFontSize(20); pdf.text('★',left+.25,top+.5); motif(pdf,theme.motif,left+cols*cell-.35,top+rows*cell-.4,.6);
  } else if (activity.type === 'spot-difference') {
    for(let row=0;row<3;row+=1){ for(let i=0;i<3;i+=1) motif(pdf,theme.motif,1.5+i*2.5,2.6+row*2.25,.55+(activity.variant==='big-small'&&i===row ? .35:0)); }
  } else if (activity.type === 'pattern' || activity.type === 'odd-one') {
    for(let row=0;row<4;row+=1){ for(let i=0;i<5;i+=1){ const changed=activity.type==='odd-one'&&i===((row+2)%5); motif(pdf,changed?(theme.motif==='space'?'magic':'space'):theme.motif,1.25+i*1.35,2.2+row*1.75,.5); } }
  } else if (activity.type === 'connect-dots') {
    const pts=[[4.2,2],[5.8,3.1],[6.2,5],[5.4,7],[4.2,8.2],[2.9,7],[2.2,5],[2.7,3.1]];
    pts.forEach(([x,y],i)=>{pdf.circle(x,y,.055,'F');pdf.setFontSize(9);pdf.text(String(i+1),x+.1,y-.08);});
  } else if (activity.type === 'draw-world') {
    pdf.roundedRect(.85,1.55,6.8,8.35,.2,.2,'S');
    motif(pdf,theme.motif,1.3,9.35,.7); motif(pdf,theme.motif,7.1,2.1,.55);
  } else if (activity.type === 'hidden-objects') {
    for(let r=0;r<5;r+=1) for(let c=0;c<6;c+=1) motif(pdf,theme.motif,1.1+c*1.2,2.0+r*1.45,.38+((r+c)%3)*.06);
    pdf.setFontSize(9); ['★','★','★','★','★','★'].forEach((s,i)=>pdf.text(s,1.25+(i%3)*2.5,2.25+Math.floor(i/3)*5.6));
  } else if (activity.type === 'name-tracing') {
    const word=activity.variant==='creative-title'?'MY GREAT ADVENTURE':childName.toUpperCase();
    for(let row=0;row<4;row+=1){pdf.setTextColor(190);pdf.setFontSize(Math.min(34,170/Math.max(4,word.length)));pdf.text(word,.9,2.4+row*1.65,{charSpace:.05});dottedLine(pdf,.9,2.7+row*1.65,7.6,2.7+row*1.65);}
  } else if (activity.type === 'story-choice') {
    if(activity.variant==='comic-prompt'){for(let i=0;i<3;i+=1)pdf.roundedRect(.65+i*2.55,2.1,2.25,5.6,.12,.12,'S');}
    else {['Explore a hidden door','Help a new friend','Discover a surprise'].forEach((label,i)=>choiceCircle(pdf,1.3,2.3+i*1.0,label));pdf.roundedRect(.9,5.7,6.7,3.5,.15,.15,'S');}
  } else if (activity.type === 'sequence') {
    for(let i=0;i<3;i+=1){pdf.roundedRect(.75+i*2.6,2.2,2.25,4.8,.12,.12,'S');motif(pdf,theme.motif,1.88+i*2.6,4.4,.65+i*.22);pdf.circle(1.88+i*2.6,7.8,.25,'S');}
  } else if (activity.type === 'design') {
    pdf.roundedRect(1.05,1.65,6.4,7.9,.2,.2,'S'); motif(pdf,theme.motif,4.25,5.35,3.1);
  } else if (activity.type === 'word-code') {
    if(activity.variant==='favorite-color'){['big / little','stars / moons','silly / sleepy','blue / yellow'].forEach((label,i)=>choiceCircle(pdf,1.25,2.2+i*1.3,label));}
    else {pdf.setFontSize(14);pdf.text('○ = A     △ = M     □ = I',1.1,2.1);pdf.setFontSize(34);pdf.text('○  △  □',4.25,4.2,{align:'center'});dottedLine(pdf,1.4,5.0,7.1,5.0);pdf.setFontSize(11);pdf.text('Write the secret word',4.25,5.35,{align:'center'});}
  } else if (activity.type === 'certificate') {
    pdf.setDrawColor(...theme.accent);pdf.setLineWidth(.06);pdf.roundedRect(.8,1.55,6.9,7.8,.22,.22,'S');
    motif(pdf,theme.motif,4.25,3.1,1.2);pdf.setTextColor(...theme.accent);pdf.setFontSize(29);pdf.text(childName,4.25,5.2,{align:'center'});pdf.setFontSize(13);pdf.text('completed the AMI Adventure Book sampler',4.25,6.0,{align:'center'});dottedLine(pdf,2.0,7.6,6.5,7.6);pdf.setTextColor(90);pdf.setFontSize(9);pdf.text('Date',4.25,7.9,{align:'center'});
  } else if (activity.type === 'next-adventure') {
    pdf.roundedRect(.85,1.6,6.8,5.4,.2,.2,'S');pdf.setFontSize(12);pdf.text('My next adventure will be about…',1.15,2.05);dottedLine(pdf,1.15,2.5,7.1,2.5);dottedLine(pdf,1.15,3.15,7.1,3.15);dottedLine(pdf,1.15,3.8,7.1,3.8);
    pdf.setFillColor(...theme.pale);pdf.roundedRect(.85,7.5,6.8,1.7,.18,.18,'F');pdf.setTextColor(...theme.accent);pdf.setFont('helvetica','bold');pdf.setFontSize(15);pdf.text(`Turn ${childName}'s ideas into a personalized AMI Storybook.`,4.25,8.15,{align:'center',maxWidth:5.8});pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.text('Visit storiesbyami.com to continue the adventure.',4.25,8.72,{align:'center'});
  }
}

export function createAdventureBookPdf(input) {
  const childName = safe(input.childName, 'Explorer');
  const age = Math.max(2, Math.min(10, Number(input.age) || 4));
  const band = getAgeBand(age);
  const theme = getAdventureTheme(input.themeId);
  const plan = input.plan || buildAdventurePlan({ childName, age, themeId: theme.id });
  const pdf = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait', compress: true });

  plan.forEach((activity, index) => {
    if (index > 0) pdf.addPage('letter', 'portrait');
    if (activity.type === 'cover') {
      pdf.setFillColor(...theme.accent);pdf.rect(0,0,W,H,'F');
      pdf.setFillColor(...theme.pale);pdf.circle(6.8,1.4,1.7,'F');pdf.circle(1.1,9.9,2.2,'F');
      pdf.setDrawColor(255,255,255);pdf.setFillColor(255,255,255);motif(pdf,theme.motif,4.25,4.35,3.2);
      pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(15);pdf.text('AMI ADVENTURE BOOK',4.25,1.25,{align:'center',charSpace:.08});
      pdf.setFontSize(32);pdf.text(`${childName}'s`,4.25,7.2,{align:'center'});pdf.setFontSize(24);pdf.text(theme.name,4.25,7.75,{align:'center'});
      pdf.setFont('helvetica','normal');pdf.setFontSize(11);pdf.text(`${band.name} · ${plan.length}-page personalized sampler`,4.25,9.75,{align:'center'});pdf.setFontSize(8);pdf.text('Created with AMI',4.25,10.3,{align:'center'});
    } else renderInterior(pdf, activity, { childName, age, band, theme });
  });

  pdf.setProperties({
    title: `${childName}'s AMI Adventure Book`,
    subject: `${theme.name} personalized activity book`,
    author: 'Stories by Ami',
    keywords: `AMI, adventure book, ${ACTIVITY_LIBRARY_VERSION}, ${band.id}, ${theme.id}`
  });
  return pdf;
}

export function downloadAdventureBook(input) {
  const pdf = createAdventureBookPdf(input);
  const filename = `${safe(input.childName,'ami').toLowerCase().replace(/\s+/g,'-')}-ami-adventure-book.pdf`;
  pdf.save(filename);
  return filename;
}
