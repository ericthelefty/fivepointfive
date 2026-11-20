import pymupdf as fitz, sys, collections
doc=fitz.open(sys.argv[1])
c=collections.Counter(); ex={}
for pno in range(len(doc)):
    for b in doc[pno].get_text('dict')['blocks']:
        for l in b.get('lines',[]):
            for s in l['spans']:
                k=(s['font'],round(s['size'],1),s['color'])
                c[k]+=len(s['text'])
                ex.setdefault(k,(pno+1,s['text'][:50]))
for k,v in c.most_common(60): print(v,k,ex[k])
