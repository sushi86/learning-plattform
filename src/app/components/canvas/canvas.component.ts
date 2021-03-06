import {AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {fromEvent} from 'rxjs';
import {pairwise, switchMap, takeUntil, tap} from 'rxjs/operators';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit {

  constructor(
    private http: HttpClient,
    private window: Window
  ) { }

  @ViewChild('canvas') public canvas: ElementRef;

  @Input() public width = 650;
  @Input() public height = 700;

  private cx: CanvasRenderingContext2D;

  line = [];
  draws = [];

  isTouchDevice = false;

  frames = 0;

  public ngAfterViewInit(): void {
    // get the context
    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;
    this.cx = canvasEl.getContext('2d');

    this.isTouchDevice = 'ontouchstart' in document.documentElement;

    // set the width and height
    canvasEl.width = this.width;
    canvasEl.height = this.height;

    // set some default properties about the line
    this.cx.lineWidth = 1;
    this.cx.lineCap = 'round';
    this.cx.lineJoin = 'round';
    this.cx.lineWidth = 10;
    this.cx.strokeStyle = '#000';

    // we'll implement this method to start capturing mouse events
    this.captureEvents(canvasEl);

    webkitRequestAnimationFrame(() => this.draw());
  }

  private captureEvents(canvasEl: HTMLCanvasElement): void {
    fromEvent(canvasEl, 'mousedown')
      .pipe(
        switchMap((e) => {
          // after a mouse down, we'll record all mouse moves
          return fromEvent(canvasEl, 'mousemove')
            .pipe(
              tap(ev => ev.preventDefault()),
              // we'll stop (and unsubscribe) once the user releases the mouse
              // this will trigger a 'mouseup' event
              takeUntil(fromEvent(canvasEl, 'mouseup').pipe(
                tap(ev => this.drawEnd(ev))
              )),
              // we'll also stop (and unsubscribe) once the mouse leaves the canvas (mouseleave event)
              takeUntil(fromEvent(canvasEl, 'mouseleave').pipe(
                tap(ev => this.drawEnd(ev))
              )),
              // pairwise lets us get the previous value to draw a line from
              // the previous point to the current point
              pairwise()
            );
        })
      )
      .subscribe((res: [MouseEvent, MouseEvent]) => {
        const rect = canvasEl.getBoundingClientRect();

        // previous and current position with the offset
        const prevPos = {
          x: res[0].clientX - rect.left,
          y: res[0].clientY - rect.top
        };

        const currentPos = {
          x: res[1].clientX - rect.left,
          y: res[1].clientY - rect.top
        };

        this.line.push({prev: prevPos, cur: currentPos});

        //this.drawOnCanvas(prevPos, currentPos);
      });

    fromEvent(canvasEl, 'touchstart')
      .pipe(
        switchMap((e) => {
          return fromEvent(canvasEl, 'touchmove')
            .pipe(
              tap(ev => ev.preventDefault()),
              takeUntil(fromEvent(canvasEl, 'touchend').pipe(
                tap(ev => this.drawEnd(ev))
              )),
              takeUntil(fromEvent(canvasEl, 'touchcancel').pipe(
                tap(ev => this.drawEnd(ev))
              )),
              pairwise()
            );
        })
      )
      .subscribe((res: [TouchEvent, TouchEvent]) => {
        const rect = canvasEl.getBoundingClientRect();

        // previous and current position with the offset
        const prevPos = {
          x: res[0].touches[0].clientX - rect.left,
          y: res[0].touches[0].clientY - rect.top
        };

        const currentPos = {
          x: res[1].touches[0].clientX - rect.left,
          y: res[1].touches[0].clientY - rect.top
        };

        this.line.push({prev: prevPos, cur: currentPos});

        //this.drawOnCanvas(prevPos, currentPos);
      });
  }

  private drawEnd(e: MouseEvent): void {
    console.log('draw end');
    console.log(e);
  }

  private drawOnCanvas(
    prevPos: { x: number; y: number },
    currentPos: { x: number; y: number }): void {
    // in case the context is not set
    if (!this.cx) { return; }

    // start our drawing path
    this.cx.beginPath();

    // we're drawing lines so we need a previous position
    if (prevPos) {
      // sets the start point
      this.cx.moveTo(prevPos.x, prevPos.y); // from

      // draws a line from the start pos until the current position
      this.cx.lineTo(currentPos.x, currentPos.y);

      this.line.push({from: prevPos, to: currentPos});
      this.sendDraws(this.line);

      // strokes the current path with the styles we set earlier
      this.cx.stroke();
    }
  }

  private draw(): void {
    this.cx.beginPath();
    this.line.forEach(e => {
      this.cx.moveTo(e.prev.x, e.prev.y);
      this.cx.lineTo(e.cur.x, e.cur.y);
      this.cx.stroke();
    });
    webkitRequestAnimationFrame(() => this.draw());
  }

  private sendDraws(line: any[]): void {
    this.http.post('http://localhost:4200/draw', line).toPromise()
      .then(r => {
        console.log(r);
        this.line = [];
      })
      .catch(e => {
        this.line = [];
      });
  }
}
