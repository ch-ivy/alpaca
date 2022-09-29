import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { GetBarParam } from './model';

@Injectable({
  providedIn: 'root',
})
export class AlpacaDataService {
  constructor(private http: HttpClient) {}

  getBarsV2Data(data: GetBarParam) {
    return this.http.post(`${environment.alpaca_api}/bar`, data);
  }
}
